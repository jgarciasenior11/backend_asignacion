import Teacher from '../models/Teacher.js';
import Career from '../models/Career.js';
import Subject from '../models/Subject.js';
import Jornada from '../models/Jornada.js';

function toClientTeacher(doc) {
  return {
    id: doc.code,
    firstName: doc.firstName,
    lastName: doc.lastName,
    email: doc.email,
    phone: doc.phone ?? '',
    specialty: doc.specialty ?? '',
    status: doc.status ?? 'active',
    careerId: doc.careerCode,
    subjectIds: doc.subjectCodes ?? [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function normaliseSubjects(subjectIds) {
  if (!subjectIds) return [];
  const arr = Array.isArray(subjectIds) ? subjectIds : [subjectIds];
  return [...new Set(arr.map((item) => String(item).trim()).filter(Boolean))];
}

async function ensureCareer(careerId) {
  if (!careerId) return;
  const exists = await Career.exists({ code: careerId.trim() });
  if (!exists) {
    throw new Error('Referenced career does not exist');
  }
}

async function ensureSubjectsBelongToCareer(subjectIds, careerId) {
  const cleanIds = normaliseSubjects(subjectIds);
  if (cleanIds.length === 0) return [];
  const subjects = await Subject.find({ code: { $in: cleanIds }, careerCode: careerId.trim() }).lean();
  if (subjects.length !== cleanIds.length) {
    throw new Error('Some selected courses do not belong to the selected career');
  }
  return cleanIds;
}

async function getCoordinatorCareerCodes(user) {
  if (!user || user.role !== 'coordinator') return null;

  const jornadas = await Jornada.find({ managerId: user.id }).select('careerCode').lean();
  const codes = new Set(
    jornadas
      .map((jornada) => jornada.careerCode)
      .filter((code) => typeof code === 'string' && code.trim().length > 0)
      .map((code) => code.trim()),
  );

  return Array.from(codes);
}

function hasCareerAccess(allowedCareers, careerId) {
  if (!Array.isArray(allowedCareers)) return true;
  if (!careerId) return false;
  return allowedCareers.includes(careerId.trim());
}

function ensureCoordinatorHasAccess(res, allowedCareers, careerId) {
  if (!Array.isArray(allowedCareers)) {
    return true;
  }

  if (allowedCareers.length === 0 || !hasCareerAccess(allowedCareers, careerId)) {
    res.status(403).json({ message: 'You do not have permission to manage teachers for this career' });
    return false;
  }

  return true;
}

export async function listTeachers(req, res) {
  const filter = {};
  let allowedCareers = null;
  if (req.user?.role === 'coordinator') {
    allowedCareers = await getCoordinatorCareerCodes(req.user);
    if (!allowedCareers || allowedCareers.length === 0) {
      return res.json([]);
    }
    filter.careerCode = { $in: allowedCareers };
  }

  const teachers = await Teacher.find(filter).sort({ lastName: 1, firstName: 1 }).lean();
  res.json(teachers.map(toClientTeacher));
}

export async function getTeacher(req, res) {
  const { id } = req.params;
  const teacher = await Teacher.findOne({ code: id }).lean();
  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found' });
  }

  if (req.user?.role === 'coordinator') {
    const allowedCareers = await getCoordinatorCareerCodes(req.user);
    if (!ensureCoordinatorHasAccess(res, allowedCareers, teacher.careerCode)) {
      return;
    }
  }

  return res.json(toClientTeacher(teacher));
}

export async function createTeacher(req, res) {
  try {
    const { id, code, firstName, lastName, email, phone, specialty, status, careerId, subjectIds } = req.body;
    const codeToUse = (code ?? id)?.trim();

    if (!codeToUse || !firstName || !lastName || !email || !careerId) {
      return res.status(400).json({ message: 'code/id, firstName, lastName, email and careerId are required' });
    }

    const duplicate = await Teacher.findOne({ code: codeToUse });
    if (duplicate) {
      return res.status(409).json({ message: 'A teacher with this code already exists' });
    }

    const allowedCareers = await getCoordinatorCareerCodes(req.user);
    if (!ensureCoordinatorHasAccess(res, allowedCareers, careerId)) {
      return;
    }

    await ensureCareer(careerId);
    const cleanSubjects = await ensureSubjectsBelongToCareer(subjectIds, careerId);

    const teacher = await Teacher.create({
      code: codeToUse,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() ?? '',
      specialty: specialty?.trim() ?? '',
      status: status ?? 'active',
      careerCode: careerId.trim(),
      subjectCodes: cleanSubjects,
    });

    return res.status(201).json(toClientTeacher(teacher));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function updateTeacher(req, res) {
  try {
    const { id } = req.params;
    const { code, firstName, lastName, email, phone, specialty, status, careerId, subjectIds } = req.body;

    const teacher = await Teacher.findOne({ code: id });
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const allowedCareers = await getCoordinatorCareerCodes(req.user);
    if (!ensureCoordinatorHasAccess(res, allowedCareers, teacher.careerCode)) {
      return;
    }

    if (code && code.trim() !== teacher.code) {
      const newCode = code.trim();
      const duplicate = await Teacher.findOne({ code: newCode, _id: { $ne: teacher._id } });
      if (duplicate) {
        return res.status(409).json({ message: 'A teacher with this code already exists' });
      }
      teacher.code = newCode;
    }

    if (careerId && careerId.trim() !== teacher.careerCode) {
      if (!ensureCoordinatorHasAccess(res, allowedCareers, careerId)) {
        return;
      }
      await ensureCareer(careerId);
      teacher.careerCode = careerId.trim();
    }

    if (subjectIds !== undefined) {
      const cleanSubjects = await ensureSubjectsBelongToCareer(subjectIds, teacher.careerCode);
      teacher.subjectCodes = cleanSubjects;
    }

    if (firstName) teacher.firstName = firstName.trim();
    if (lastName) teacher.lastName = lastName.trim();
    if (email) teacher.email = email.trim().toLowerCase();
    if (phone !== undefined) teacher.phone = phone?.trim() ?? '';
    if (specialty !== undefined) teacher.specialty = specialty?.trim() ?? '';
    if (status) teacher.status = status;

    await teacher.save();
    return res.json(toClientTeacher(teacher));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function deleteTeacher(req, res) {
  const { id } = req.params;
  const teacher = await Teacher.findOne({ code: id });
  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found' });
  }

  const allowedCareers = await getCoordinatorCareerCodes(req.user);
  if (!ensureCoordinatorHasAccess(res, allowedCareers, teacher.careerCode)) {
    return;
  }

  await teacher.deleteOne();
  return res.status(204).send();
}
