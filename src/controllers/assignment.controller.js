import mongoose from 'mongoose';
import Assignment from '../models/Assignment.js';
import Subject from '../models/Subject.js';
import Teacher from '../models/Teacher.js';
import Classroom from '../models/Classroom.js';
import TimeSlot from '../models/TimeSlot.js';
import Section from '../models/Section.js';
import Jornada from '../models/Jornada.js';

function toClientAssignment(doc) {
  return {
    id: doc.code,
    subjectId: doc.subjectCode,
    teacherId: doc.teacherCode,
    classroomId: doc.classroomCode,
    timeSlotId: doc.timeSlotCode,
    jornadaId: doc.jornadaCode,
    sectionId: doc.sectionCode,
    period: doc.period,
    matrixId: doc.matrixId ?? doc.groupId ?? `legacy|${doc.period}|${doc.jornadaCode}|${doc.sectionCode}`,
    semester: doc.semester ?? null,
    notes: doc.notes ?? '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function normaliseAssignmentPayload(raw) {
  const trim = (value) => (typeof value === 'string' ? value.trim() : '');
  const assignment = {
    code: trim(raw.id ?? raw.code ?? ''),
    subjectCode: trim(raw.subjectId ?? raw.subjectCode ?? ''),
    teacherCode: trim(raw.teacherId ?? raw.teacherCode ?? ''),
    classroomCode: trim(raw.classroomId ?? raw.classroomCode ?? ''),
    timeSlotCode: trim(raw.timeSlotId ?? raw.timeSlotCode ?? ''),
    jornadaCode: trim(raw.jornadaId ?? raw.jornadaCode ?? ''),
    sectionCode: trim(raw.sectionId ?? raw.sectionCode ?? ''),
    period: trim(raw.period ?? ''),
    matrixId: trim(raw.matrixId ?? raw.groupId ?? ''),
    semester: raw.semester ? Number(raw.semester) : null,
    notes: trim(raw.notes ?? ''),
  };

  if (assignment.semester !== null && (Number.isNaN(assignment.semester) || assignment.semester < 1 || assignment.semester > 12)) {
    throw new Error('semester must be a number between 1 and 12 when provided');
  }

  return assignment;
}

function ensureRequiredFields(assignment) {
  if (
    !assignment.subjectCode ||
    !assignment.teacherCode ||
    !assignment.classroomCode ||
    !assignment.timeSlotCode ||
    !assignment.jornadaCode ||
    !assignment.sectionCode ||
    !assignment.period ||
    !assignment.matrixId
  ) {
    throw new Error('subjectId, teacherId, classroomId, timeSlotId, jornadaId, sectionId, period and matrixId are required for each assignment');
  }
}

async function loadMatrixDetails(matrixId) {
  let assignments = await Assignment.find({ matrixId }).sort({ timeSlotCode: 1 }).lean();
  if (assignments.length === 0 && typeof matrixId === 'string' && matrixId.startsWith('legacy|')) {
    const [, period, jornadaCode, sectionCode] = matrixId.split('|');
    assignments = await Assignment.find({
      period,
      jornadaCode,
      sectionCode,
    })
      .sort({ timeSlotCode: 1 })
      .lean();

    const idsToUpdate = assignments.filter((item) => !item.matrixId).map((item) => item._id);
    if (idsToUpdate.length > 0) {
      await Assignment.updateMany({ _id: { $in: idsToUpdate } }, { matrixId });
    }
  }

  if (assignments.length === 0) {
    return null;
  }
  const mapped = assignments.map(toClientAssignment);
  const base = mapped[0];
  return {
    matrixId,
    period: base.period,
    jornadaId: base.jornadaId,
    sectionId: base.sectionId,
    semester: base.semester ?? null,
    entries: mapped,
    createdAt: assignments.reduce((min, item) => (item.createdAt < min ? item.createdAt : min), assignments[0].createdAt),
    updatedAt: assignments.reduce((max, item) => (item.updatedAt > max ? item.updatedAt : max), assignments[0].updatedAt),
  };
}

export async function listAssignments(req, res) {
  const { jornadaId, period, teacherId, sectionId, grouped } = req.query;

  const filter = {};
  if (jornadaId) filter.jornadaCode = jornadaId;
  if (period) filter.period = period;
  if (teacherId) filter.teacherCode = teacherId;
  if (sectionId) filter.sectionCode = sectionId;

  const assignments = await Assignment.find(filter)
    .sort({ period: 1, jornadaCode: 1, timeSlotCode: 1 })
    .lean();

  const mapped = assignments.map(toClientAssignment);

  if (grouped === 'true') {
    const groupedData = mapped.reduce((acc, assignment) => {
      const key = assignment.matrixId;
      if (!acc.has(key)) {
        acc.set(key, {
          matrixId: key,
          period: assignment.period,
          jornadaId: assignment.jornadaId,
          sectionId: assignment.sectionId,
          semester: assignment.semester ?? null,
          entries: [],
          createdAt: assignment.createdAt,
          updatedAt: assignment.updatedAt,
        });
      }
      const group = acc.get(key);
      group.entries.push(assignment);
      if (assignment.createdAt < group.createdAt) group.createdAt = assignment.createdAt;
      if (assignment.updatedAt > group.updatedAt) group.updatedAt = assignment.updatedAt;
      return acc;
    }, new Map());

    const result = Array.from(groupedData.values()).map((group) => ({
      ...group,
      entries: group.entries.sort((a, b) => a.timeSlotId.localeCompare(b.timeSlotId)),
    }));

    result.sort((a, b) => a.period.localeCompare(b.period) || a.jornadaId.localeCompare(b.jornadaId));

    return res.json(result);
  }

  return res.json(mapped);
}

export async function deleteAssignment(req, res) {
  const { id } = req.params;
  const assignment = await Assignment.findOne({ code: id });
  if (!assignment) {
    return res.status(404).json({ message: 'Assignment not found' });
  }

  await assignment.deleteOne();
  return res.status(204).send();
}

export async function createAssignments(req, res) {
  const payload = Array.isArray(req.body) ? req.body : req.body.assignments;
  if (!Array.isArray(payload) || payload.length === 0) {
    return res.status(400).json({ message: 'assignments array is required' });
  }

  let normalised;
  try {
    normalised = payload.map((item) => normaliseAssignmentPayload(item));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  try {
    const baseMatrixId = normalised[0].matrixId || `ASGM-${Date.now()}`;
    const codes = new Set();
    const teacherKeys = new Set();
    const classroomKeys = new Set();
    const sectionKeys = new Set();
    const duplicateChecker = new Set();

    for (const assignment of normalised) {
      if (!assignment.matrixId) {
        assignment.matrixId = baseMatrixId;
      }
      ensureRequiredFields(assignment);
      const key = `${assignment.period}|${assignment.timeSlotCode}`;

      const teacherKey = `${key}|teacher|${assignment.teacherCode}`;
      if (teacherKeys.has(teacherKey)) {
        throw new Error('Duplicate teacher in the same time slot within the request payload');
      }
      teacherKeys.add(teacherKey);

      const classroomKey = `${key}|classroom|${assignment.classroomCode}`;
      if (classroomKeys.has(classroomKey)) {
        throw new Error('Duplicate classroom in the same time slot within the request payload');
      }
      classroomKeys.add(classroomKey);

      const sectionKey = `${key}|section|${assignment.sectionCode}`;
      if (sectionKeys.has(sectionKey)) {
        throw new Error('Duplicate section in the same time slot within the request payload');
      }
      sectionKeys.add(sectionKey);

      const duplicateKey = `${key}|subject|${assignment.subjectCode}|section|${assignment.sectionCode}`;
      if (duplicateChecker.has(duplicateKey)) {
        throw new Error('Duplicate subject for the same section and time slot within the request payload');
      }
      duplicateChecker.add(duplicateKey);

      if (assignment.code) {
        const codeKey = assignment.code.toUpperCase();
        if (codes.has(codeKey)) {
          throw new Error('Duplicate assignment id/code within the request payload');
        }
        codes.add(codeKey);
      }
    }

    const subjectCodes = [...new Set(normalised.map((item) => item.subjectCode))];
    const teacherCodes = [...new Set(normalised.map((item) => item.teacherCode))];
    const classroomCodes = [...new Set(normalised.map((item) => item.classroomCode))];
    const timeSlotCodes = [...new Set(normalised.map((item) => item.timeSlotCode))];
    const sectionCodes = [...new Set(normalised.map((item) => item.sectionCode))];
    const jornadaCodes = [...new Set(normalised.map((item) => item.jornadaCode))];

    const [subjects, teachers, classrooms, timeSlots, sections, jornadas] = await Promise.all([
      Subject.find({ code: { $in: subjectCodes } }).lean(),
      Teacher.find({ code: { $in: teacherCodes } }).lean(),
      Classroom.find({ code: { $in: classroomCodes } }).lean(),
      TimeSlot.find({ code: { $in: timeSlotCodes } }).lean(),
      Section.find({ code: { $in: sectionCodes } }).lean(),
      Jornada.find({ code: { $in: jornadaCodes } }).lean(),
    ]);

    const subjectMap = new Map(subjects.map((subject) => [subject.code, subject]));
    const teacherMap = new Map(teachers.map((teacher) => [teacher.code, teacher]));
    const classroomMap = new Map(classrooms.map((classroom) => [classroom.code, classroom]));
    const timeSlotMap = new Map(timeSlots.map((slot) => [slot.code, slot]));
    const sectionMap = new Map(sections.map((section) => [section.code, section]));
    const jornadaMap = new Map(jornadas.map((jornada) => [jornada.code, jornada]));

    for (const assignment of normalised) {
      const subject = subjectMap.get(assignment.subjectCode);
      if (!subject) {
        throw new Error(`Subject ${assignment.subjectCode} does not exist`);
      }

      const teacher = teacherMap.get(assignment.teacherCode);
      if (!teacher) {
        throw new Error(`Teacher ${assignment.teacherCode} does not exist`);
      }
      if (teacher.status === 'inactive') {
        throw new Error(`Teacher ${assignment.teacherCode} is inactive`);
      }
      if (!teacher.subjectCodes?.includes(assignment.subjectCode)) {
        throw new Error(`Teacher ${assignment.teacherCode} is not associated with subject ${assignment.subjectCode}`);
      }
      if (teacher.careerCode !== subject.careerCode) {
        throw new Error(`Teacher ${assignment.teacherCode} and subject ${assignment.subjectCode} belong to different careers`);
      }

      const classroom = classroomMap.get(assignment.classroomCode);
      if (!classroom) {
        throw new Error(`Classroom ${assignment.classroomCode} does not exist`);
      }
      if (classroom.isEnabled === false) {
        throw new Error(`Classroom ${assignment.classroomCode} is disabled`);
      }

      const timeSlot = timeSlotMap.get(assignment.timeSlotCode);
      if (!timeSlot) {
        throw new Error(`Time slot ${assignment.timeSlotCode} does not exist`);
      }

      const section = sectionMap.get(assignment.sectionCode);
      if (!section) {
        throw new Error(`Section ${assignment.sectionCode} does not exist`);
      }
      if (section.status === 'inactive') {
        throw new Error(`Section ${assignment.sectionCode} is inactive`);
      }

      const jornada = jornadaMap.get(assignment.jornadaCode);
      if (!jornada) {
        throw new Error(`Jornada ${assignment.jornadaCode} does not exist`);
      }
      if (timeSlot.jornadaCode !== assignment.jornadaCode) {
        throw new Error(`Time slot ${assignment.timeSlotCode} does not belong to jornada ${assignment.jornadaCode}`);
      }
      if (section.jornadaCode !== assignment.jornadaCode) {
        throw new Error(`Section ${assignment.sectionCode} does not belong to jornada ${assignment.jornadaCode}`);
      }

      if (assignment.semester === null || assignment.semester === undefined) {
        assignment.semester = section.semester ?? null;
      }
    }

    // Check conflicts against existing assignments
    for (const assignment of normalised) {
      const { period, timeSlotCode, teacherCode, classroomCode, sectionCode } = assignment;
      const conflict = await Assignment.findOne({
        period,
        timeSlotCode,
        $or: [
          { teacherCode },
          { classroomCode },
          { sectionCode },
        ],
      }).lean();

      if (conflict) {
        if (conflict.teacherCode === teacherCode) {
          throw new Error(`Teacher ${teacherCode} already has an assignment in time slot ${timeSlotCode} for period ${period}`);
        }
        if (conflict.classroomCode === classroomCode) {
          throw new Error(`Classroom ${classroomCode} is already assigned in time slot ${timeSlotCode} for period ${period}`);
        }
        if (conflict.sectionCode === sectionCode) {
          throw new Error(`Section ${sectionCode} already has an assignment in time slot ${timeSlotCode} for period ${period}`);
        }
        throw new Error('Assignment conflict detected');
      }
    }

    const timestamp = Date.now();
    let counter = 0;
    const docsToInsert = normalised.map((item) => ({
      ...item,
      matrixId: item.matrixId || baseMatrixId,
      code: item.code || `ASG-${timestamp + counter++}`,
    }));

    const inserted = await Assignment.insertMany(docsToInsert, { ordered: true });

    return res.status(201).json(inserted.map(toClientAssignment));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getAssignmentMatrix(req, res) {
  const { id } = req.params;
  const matrix = await loadMatrixDetails(id);
  if (!matrix) {
    return res.status(404).json({ message: 'Assignment matrix not found' });
  }
  return res.json(matrix);
}

export async function updateAssignmentMatrix(req, res) {
  const { id } = req.params;
  const payload = Array.isArray(req.body) ? req.body : req.body.assignments;
  if (!Array.isArray(payload) || payload.length === 0) {
    return res.status(400).json({ message: 'assignments array is required' });
  }

  let normalised;
  try {
    normalised = payload.map((item) => {
      const prepared = normaliseAssignmentPayload(item);
      prepared.matrixId = id;
      return prepared;
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const baseMatrixId = id;
      const codes = new Set();
      const teacherKeys = new Set();
      const classroomKeys = new Set();
      const sectionKeys = new Set();
      const duplicateChecker = new Set();

      for (const assignment of normalised) {
        assignment.matrixId = baseMatrixId;
        ensureRequiredFields(assignment);
        const key = `${assignment.period}|${assignment.timeSlotCode}`;

        const teacherKey = `${key}|teacher|${assignment.teacherCode}`;
        if (teacherKeys.has(teacherKey)) {
          throw new Error('Duplicate teacher in the same time slot within the request payload');
        }
        teacherKeys.add(teacherKey);

        const classroomKey = `${key}|classroom|${assignment.classroomCode}`;
        if (classroomKeys.has(classroomKey)) {
          throw new Error('Duplicate classroom in the same time slot within the request payload');
        }
        classroomKeys.add(classroomKey);

        const sectionKey = `${key}|section|${assignment.sectionCode}`;
        if (sectionKeys.has(sectionKey)) {
          throw new Error('Duplicate section in the same time slot within the request payload');
        }
        sectionKeys.add(sectionKey);

        const duplicateKey = `${key}|subject|${assignment.subjectCode}|section|${assignment.sectionCode}`;
        if (duplicateChecker.has(duplicateKey)) {
          throw new Error('Duplicate subject for the same section and time slot within the request payload');
        }
        duplicateChecker.add(duplicateKey);

        if (assignment.code) {
          const codeKey = assignment.code.toUpperCase();
          if (codes.has(codeKey)) {
            throw new Error('Duplicate assignment id/code within the request payload');
          }
          codes.add(codeKey);
        }
      }

      const subjectCodes = [...new Set(normalised.map((item) => item.subjectCode))];
      const teacherCodes = [...new Set(normalised.map((item) => item.teacherCode))];
      const classroomCodes = [...new Set(normalised.map((item) => item.classroomCode))];
      const timeSlotCodes = [...new Set(normalised.map((item) => item.timeSlotCode))];
      const sectionCodes = [...new Set(normalised.map((item) => item.sectionCode))];
      const jornadaCodes = [...new Set(normalised.map((item) => item.jornadaCode))];

      const [subjects, teachers, classrooms, timeSlots, sections, jornadas] = await Promise.all([
        Subject.find({ code: { $in: subjectCodes } }).lean(),
        Teacher.find({ code: { $in: teacherCodes } }).lean(),
        Classroom.find({ code: { $in: classroomCodes } }).lean(),
        TimeSlot.find({ code: { $in: timeSlotCodes } }).lean(),
        Section.find({ code: { $in: sectionCodes } }).lean(),
        Jornada.find({ code: { $in: jornadaCodes } }).lean(),
      ]);

      const subjectMap = new Map(subjects.map((subject) => [subject.code, subject]));
      const teacherMap = new Map(teachers.map((teacher) => [teacher.code, teacher]));
      const classroomMap = new Map(classrooms.map((classroom) => [classroom.code, classroom]));
      const timeSlotMap = new Map(timeSlots.map((slot) => [slot.code, slot]));
      const sectionMap = new Map(sections.map((section) => [section.code, section]));
      const jornadaMap = new Map(jornadas.map((jornada) => [jornada.code, jornada]));

      for (const assignment of normalised) {
        const subject = subjectMap.get(assignment.subjectCode);
        if (!subject) {
          throw new Error(`Subject ${assignment.subjectCode} does not exist`);
        }

        const teacher = teacherMap.get(assignment.teacherCode);
        if (!teacher) {
          throw new Error(`Teacher ${assignment.teacherCode} does not exist`);
        }
        if (teacher.status === 'inactive') {
          throw new Error(`Teacher ${assignment.teacherCode} is inactive`);
        }
        if (!teacher.subjectCodes?.includes(assignment.subjectCode)) {
          throw new Error(`Teacher ${assignment.teacherCode} is not associated with subject ${assignment.subjectCode}`);
        }
        if (teacher.careerCode !== subject.careerCode) {
          throw new Error(`Teacher ${assignment.teacherCode} and subject ${assignment.subjectCode} belong to different careers`);
        }

        const classroom = classroomMap.get(assignment.classroomCode);
        if (!classroom) {
          throw new Error(`Classroom ${assignment.classroomCode} does not exist`);
        }
        if (classroom.isEnabled === false) {
          throw new Error(`Classroom ${assignment.classroomCode} is disabled`);
        }

        const timeSlot = timeSlotMap.get(assignment.timeSlotCode);
        if (!timeSlot) {
          throw new Error(`Time slot ${assignment.timeSlotCode} does not exist`);
        }

        const section = sectionMap.get(assignment.sectionCode);
        if (!section) {
          throw new Error(`Section ${assignment.sectionCode} does not exist`);
        }
        if (section.status === 'inactive') {
          throw new Error(`Section ${assignment.sectionCode} is inactive`);
        }

        const jornada = jornadaMap.get(assignment.jornadaCode);
        if (!jornada) {
          throw new Error(`Jornada ${assignment.jornadaCode} does not exist`);
        }
        if (timeSlot.jornadaCode !== assignment.jornadaCode) {
          throw new Error(`Time slot ${assignment.timeSlotCode} does not belong to jornada ${assignment.jornadaCode}`);
        }
        if (section.jornadaCode !== assignment.jornadaCode) {
          throw new Error(`Section ${assignment.sectionCode} does not belong to jornada ${assignment.jornadaCode}`);
        }

        if (assignment.semester === null || assignment.semester === undefined) {
          assignment.semester = section.semester ?? null;
        }
      }

      for (const assignment of normalised) {
        const { period, timeSlotCode, teacherCode, classroomCode, sectionCode } = assignment;
        const conflict = await Assignment.findOne({
          period,
          timeSlotCode,
          matrixId: { $ne: id },
          $or: [
            { teacherCode },
            { classroomCode },
            { sectionCode },
          ],
        })
          .session(session)
          .lean();

        if (conflict) {
          if (conflict.teacherCode === teacherCode) {
            throw new Error(`Teacher ${teacherCode} already has an assignment in time slot ${timeSlotCode} for period ${period}`);
          }
          if (conflict.classroomCode === classroomCode) {
            throw new Error(`Classroom ${classroomCode} is already assigned in time slot ${timeSlotCode} for period ${period}`);
          }
          if (conflict.sectionCode === sectionCode) {
            throw new Error(`Section ${sectionCode} already has an assignment in time slot ${timeSlotCode} for period ${period}`);
          }
          throw new Error('Assignment conflict detected');
        }
      }

      await Assignment.deleteMany({ matrixId: id }).session(session);

      const timestamp = Date.now();
      let counter = 0;
      const docsToInsert = normalised.map((item) => ({
        ...item,
        matrixId: id,
        code: item.code || `ASG-${timestamp + counter++}`,
      }));

      await Assignment.insertMany(docsToInsert, { session, ordered: true });
    });

    const matrix = await loadMatrixDetails(id);
    return res.json(matrix);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  } finally {
    await session.endSession();
  }
}

export async function deleteAssignmentMatrix(req, res) {
  const { id } = req.params;
  const result = await Assignment.deleteMany({ matrixId: id });
  if (!result.deletedCount) {
    return res.status(404).json({ message: 'Assignment matrix not found' });
  }
  return res.status(204).send();
}
