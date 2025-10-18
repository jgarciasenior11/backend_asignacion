import Subject from '../models/Subject.js';
import Career from '../models/Career.js';

function toClientSubject(doc) {
  return {
    id: doc.code,
    name: doc.name,
    careerId: doc.careerCode,
    description: doc.description ?? '',
    definitionType: doc.definitionType ?? 'credits',
    credits: doc.credits ?? null,
    dependsOn: doc.dependsOn ?? '',
    semester: doc.semester ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function normalizeDefinition(payload) {
  const definitionType = payload.definitionType === 'dependency' ? 'dependency' : 'credits';
  const result = {
    definitionType,
    credits: null,
    dependsOn: null,
  };

  if (definitionType === 'credits') {
    const credits = Number(payload.credits);
    if (Number.isNaN(credits) || credits <= 0) {
      throw new Error('credits must be a number greater than 0');
    }
    result.credits = credits;
  } else {
    const dependsOn = payload.dependsOn?.trim();
    if (!dependsOn) {
      throw new Error('dependsOn is required when definitionType is dependency');
    }
    result.dependsOn = dependsOn;
  }

  return result;
}

function normalizeSemester(value) {
  if (value === undefined || value === null || value === '') return null;
  const semesterNumber = Number(value);
  if (Number.isNaN(semesterNumber) || semesterNumber <= 0) {
    throw new Error('semester must be a number greater than 0');
  }
  return semesterNumber;
}

export async function listSubjects(req, res) {
  const { careerId } = req.query;

  const filter = {};
  if (careerId) {
    filter.careerCode = careerId;
  }

  const subjects = await Subject.find(filter).sort({ semester: 1, name: 1 }).lean();
  res.json(subjects.map(toClientSubject));
}

export async function getSubject(req, res) {
  const { id } = req.params;
  const subject = await Subject.findOne({ code: id }).lean();

  if (!subject) {
    return res.status(404).json({ message: 'Subject not found' });
  }

  return res.json(toClientSubject(subject));
}

export async function createSubject(req, res) {
  try {
    const { id, code, name, description, careerId, definitionType, credits, dependsOn, semester } = req.body;
    const codeToUse = (code ?? id)?.trim();

    if (!codeToUse || !name || !careerId) {
      return res.status(400).json({ message: 'code/id, name and careerId are required' });
    }

    const careerExists = await Career.exists({ code: careerId.trim() });
    if (!careerExists) {
      return res.status(400).json({ message: 'Referenced career does not exist' });
    }

    const existing = await Subject.findOne({ code: codeToUse });
    if (existing) {
      return res.status(409).json({ message: 'A subject with this code already exists' });
    }

    const normalizedDefinition = normalizeDefinition({ definitionType, credits, dependsOn });

    if (normalizedDefinition.dependsOn) {
      if (normalizedDefinition.dependsOn === codeToUse) {
        return res.status(400).json({ message: 'A subject cannot depend on itself' });
      }
      const dependencyExists = await Subject.exists({ code: normalizedDefinition.dependsOn, careerCode: careerId.trim() });
      if (!dependencyExists) {
        return res.status(400).json({ message: 'Referenced dependency does not exist in this career' });
      }
    }

    const newSubject = await Subject.create({
      code: codeToUse,
      name: name.trim(),
      careerCode: careerId.trim(),
      description: description?.trim(),
      definitionType: normalizedDefinition.definitionType,
      credits: normalizedDefinition.credits,
      dependsOn: normalizedDefinition.dependsOn,
      semester: normalizeSemester(semester),
    });

    return res.status(201).json(toClientSubject(newSubject));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function updateSubject(req, res) {
  try {
    const { id } = req.params;
    const { code, name, description, careerId, definitionType, credits, dependsOn, semester } = req.body;

    const subject = await Subject.findOne({ code: id });
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    if (careerId && careerId.trim() !== subject.careerCode) {
      const careerExists = await Career.exists({ code: careerId.trim() });
      if (!careerExists) {
        return res.status(400).json({ message: 'Referenced career does not exist' });
      }
      subject.careerCode = careerId.trim();
    }

    const normalizedDefinition = normalizeDefinition({
      definitionType: definitionType ?? subject.definitionType,
      credits: credits ?? subject.credits,
      dependsOn: dependsOn ?? subject.dependsOn,
    });

    if (normalizedDefinition.dependsOn) {
      const dependencyExists = await Subject.exists({
        code: normalizedDefinition.dependsOn,
        careerCode: subject.careerCode,
      });
      if (!dependencyExists) {
        return res.status(400).json({ message: 'Referenced dependency does not exist in this career' });
      }
      if (normalizedDefinition.dependsOn === (code?.trim() ?? subject.code)) {
        return res.status(400).json({ message: 'A subject cannot depend on itself' });
      }
    }

    if (code && code.trim() !== subject.code) {
      const duplicate = await Subject.findOne({ code: code.trim(), _id: { $ne: subject._id } });
      if (duplicate) {
        return res.status(409).json({ message: 'A subject with this code already exists' });
      }
      const newCode = code.trim();
      await Subject.updateMany({ dependsOn: subject.code }, { dependsOn: newCode });
      subject.code = newCode;
    }

    if (name) subject.name = name.trim();
    if (description !== undefined) subject.description = description?.trim() ?? '';
    subject.definitionType = normalizedDefinition.definitionType;
    subject.credits = normalizedDefinition.credits;
    subject.dependsOn = normalizedDefinition.dependsOn;
    subject.semester = normalizeSemester(semester ?? subject.semester) ?? subject.semester;

    await subject.save();

    return res.json(toClientSubject(subject));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function deleteSubject(req, res) {
  const { id } = req.params;
  const subject = await Subject.findOne({ code: id });

  if (!subject) {
    return res.status(404).json({ message: 'Subject not found' });
  }

  const dependent = await Subject.exists({ dependsOn: subject.code });
  if (dependent) {
    return res.status(400).json({ message: 'Cannot delete a subject that other subjects depend on' });
  }

  await subject.deleteOne();
  return res.status(204).send();
}
