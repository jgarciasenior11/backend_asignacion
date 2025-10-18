import Career from '../models/Career.js';
import Faculty from '../models/Faculty.js';
import Subject from '../models/Subject.js';
import Jornada from '../models/Jornada.js';
import Section from '../models/Section.js';
import TimeSlot from '../models/TimeSlot.js';

function normalizeLevels(levels) {
  if (!levels) return [];
  if (Array.isArray(levels)) {
    return levels.map((level) => level.trim()).filter(Boolean);
  }
  return String(levels)
    .split(',')
    .map((level) => level.trim())
    .filter(Boolean);
}

function toClientCareer(doc) {
  return {
    id: doc.code,
    name: doc.name,
    description: doc.description ?? '',
    facultyId: doc.facultyCode,
    levels: doc.levels ?? [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listCareers(req, res) {
  const careers = await Career.find().sort({ name: 1 }).lean();
  res.json(careers.map(toClientCareer));
}

export async function getCareer(req, res) {
  const { id } = req.params;
  const career = await Career.findOne({ code: id }).lean();

  if (!career) {
    return res.status(404).json({ message: 'Career not found' });
  }

  return res.json(toClientCareer(career));
}

export async function createCareer(req, res) {
  const { id, code, name, description, facultyId, levels } = req.body;
  const codeToUse = (code ?? id)?.trim();

  if (!codeToUse || !name || !facultyId) {
    return res.status(400).json({ message: 'code/id, name and facultyId are required' });
  }

  const facultyExists = await Faculty.exists({ code: facultyId.trim() });
  if (!facultyExists) {
    return res.status(400).json({ message: 'Referenced faculty does not exist' });
  }

  const existing = await Career.findOne({ code: codeToUse });
  if (existing) {
    return res.status(409).json({ message: 'A career with this code already exists' });
  }

  const career = await Career.create({
    code: codeToUse,
    name: name.trim(),
    description: description?.trim(),
    facultyCode: facultyId.trim(),
    levels: normalizeLevels(levels),
  });

  return res.status(201).json(toClientCareer(career));
}

export async function updateCareer(req, res) {
  const { id } = req.params;
  const { code, name, description, facultyId, levels } = req.body;

  const career = await Career.findOne({ code: id });
  if (!career) {
    return res.status(404).json({ message: 'Career not found' });
  }

  if (code && code.trim() !== career.code) {
    const newCode = code.trim();
    const duplicate = await Career.findOne({ code: newCode, _id: { $ne: career._id } });
    if (duplicate) {
      return res.status(409).json({ message: 'A career with this code already exists' });
    }
    await Subject.updateMany({ careerCode: career.code }, { careerCode: newCode });
    await Jornada.updateMany({ careerCode: career.code }, { careerCode: newCode });
    career.code = newCode;
  }

  if (name) career.name = name.trim();
  if (typeof description === 'string') career.description = description.trim();

  if (facultyId && facultyId.trim() !== career.facultyCode) {
    const facultyExists = await Faculty.exists({ code: facultyId.trim() });
    if (!facultyExists) {
      return res.status(400).json({ message: 'Referenced faculty does not exist' });
    }
    career.facultyCode = facultyId.trim();
  }

  if (levels !== undefined) {
    career.levels = normalizeLevels(levels);
  }

  await career.save();

  return res.json(toClientCareer(career));
}

export async function deleteCareer(req, res) {
  const { id } = req.params;
  const career = await Career.findOne({ code: id });

  if (!career) {
    return res.status(404).json({ message: 'Career not found' });
  }

  await Subject.deleteMany({ careerCode: career.code });
  const jornadaCodes = await Jornada.find({ careerCode: career.code }).distinct('code');
  await Jornada.deleteMany({ careerCode: career.code });
  if (jornadaCodes.length > 0) {
    await Section.deleteMany({ jornadaCode: { $in: jornadaCodes } });
    await TimeSlot.deleteMany({ jornadaCode: { $in: jornadaCodes } });
  }
  await career.deleteOne();
  return res.status(204).send();
}
