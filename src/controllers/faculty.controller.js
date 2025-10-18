import Faculty from '../models/Faculty.js';

function toClientFaculty(doc) {
  return {
    id: doc.code,
    name: doc.name,
    dean: doc.dean ?? '',
    description: doc.description ?? '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listFaculties(req, res) {
  const faculties = await Faculty.find().sort({ name: 1 }).lean();
  res.json(faculties.map(toClientFaculty));
}

export async function getFaculty(req, res) {
  const { id } = req.params;
  const faculty = await Faculty.findOne({ code: id }).lean();

  if (!faculty) {
    return res.status(404).json({ message: 'Faculty not found' });
  }

  return res.json(toClientFaculty(faculty));
}

export async function createFaculty(req, res) {
  const { id, code, name, dean, description } = req.body;

  const codeToUse = (code ?? id)?.trim();

  if (!codeToUse || !name) {
    return res.status(400).json({ message: 'code/id and name are required' });
  }

  const existing = await Faculty.findOne({ code: codeToUse });
  if (existing) {
    return res.status(409).json({ message: 'A faculty with this code already exists' });
  }

  const faculty = await Faculty.create({
    code: codeToUse,
    name: name.trim(),
    dean: dean?.trim(),
    description: description?.trim(),
  });

  return res.status(201).json(toClientFaculty(faculty));
}

export async function updateFaculty(req, res) {
  const { id } = req.params;
  const { code, name, dean, description } = req.body;

  const faculty = await Faculty.findOne({ code: id });
  if (!faculty) {
    return res.status(404).json({ message: 'Faculty not found' });
  }

  if (code && code.trim() !== faculty.code) {
    const duplicate = await Faculty.findOne({ code: code.trim(), _id: { $ne: faculty._id } });
    if (duplicate) {
      return res.status(409).json({ message: 'A faculty with this code already exists' });
    }
    faculty.code = code.trim();
  }

  if (name) faculty.name = name.trim();
  if (typeof dean === 'string') faculty.dean = dean.trim();
  if (typeof description === 'string') faculty.description = description.trim();

  await faculty.save();
  return res.json(toClientFaculty(faculty));
}

export async function deleteFaculty(req, res) {
  const { id } = req.params;
  const faculty = await Faculty.findOne({ code: id });

  if (!faculty) {
    return res.status(404).json({ message: 'Faculty not found' });
  }

  await faculty.deleteOne();
  return res.status(204).send();
}
