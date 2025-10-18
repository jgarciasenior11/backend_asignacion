import Classroom from '../models/Classroom.js';
import Building from '../models/Building.js';

function toClientClassroom(doc) {
  return {
    id: doc.code,
    name: doc.name,
    description: doc.description ?? '',
    buildingId: doc.buildingCode,
    level: doc.level ?? 1,
    roomNumber: doc.roomNumber ?? '',
    capacity: doc.capacity ?? 0,
    type: doc.type ?? '',
    isEnabled: doc.isEnabled ?? true,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listClassrooms(req, res) {
  const { buildingId } = req.query;

  const filter = {};
  if (buildingId) {
    filter.buildingCode = buildingId;
  }

  const classrooms = await Classroom.find(filter).sort({ code: 1 }).lean();
  res.json(classrooms.map(toClientClassroom));
}

export async function getClassroom(req, res) {
  const { id } = req.params;
  const classroom = await Classroom.findOne({ code: id }).lean();

  if (!classroom) {
    return res.status(404).json({ message: 'Classroom not found' });
  }

  return res.json(toClientClassroom(classroom));
}

export async function createClassroom(req, res) {
  const { id, code, name, description, buildingId, level, roomNumber, capacity, type, isEnabled } = req.body;
  const codeToUse = (code ?? id)?.trim();

  if (!codeToUse || !buildingId) {
    return res.status(400).json({ message: 'code/id and buildingId are required' });
  }

  const building = await Building.findOne({ code: buildingId.trim() }).lean();
  if (!building) {
    return res.status(400).json({ message: 'Referenced building does not exist' });
  }

  const existing = await Classroom.findOne({ code: codeToUse });
  if (existing) {
    return res.status(409).json({ message: 'A classroom with this code already exists' });
  }

  const normalizedLevel = Number(level) > 0 ? Number(level) : 1;
  if (building.levels && normalizedLevel > building.levels) {
    return res.status(400).json({ message: `Building has only ${building.levels} levels` });
  }

  const classroom = await Classroom.create({
    code: codeToUse,
    name: (name ?? codeToUse).trim(),
    description: description?.trim(),
    buildingCode: buildingId.trim(),
    level: normalizedLevel,
    roomNumber: roomNumber !== undefined ? String(roomNumber).trim() : '',
    capacity: Number(capacity) > 0 ? Number(capacity) : 0,
    type: type !== undefined ? String(type).trim() : '',
    isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
  });

  return res.status(201).json(toClientClassroom(classroom));
}

export async function updateClassroom(req, res) {
  const { id } = req.params;
  const { code, name, description, buildingId, level, roomNumber, capacity, type, isEnabled } = req.body;

  const classroom = await Classroom.findOne({ code: id });
  if (!classroom) {
    return res.status(404).json({ message: 'Classroom not found' });
  }

  if (code && code.trim() !== classroom.code) {
    const duplicate = await Classroom.findOne({ code: code.trim(), _id: { $ne: classroom._id } });
    if (duplicate) {
      return res.status(409).json({ message: 'A classroom with this code already exists' });
    }
    classroom.code = code.trim();
  }

  if (buildingId && buildingId.trim() !== classroom.buildingCode) {
    const newBuilding = await Building.findOne({ code: buildingId.trim() }).lean();
    if (!newBuilding) {
      return res.status(400).json({ message: 'Referenced building does not exist' });
    }
    classroom.buildingCode = buildingId.trim();
    if (classroom.level > newBuilding.levels) {
      classroom.level = newBuilding.levels ?? classroom.level;
    }
  }

  if (name) classroom.name = name.trim();
  if (typeof description === 'string') classroom.description = description.trim();
  if (roomNumber !== undefined) classroom.roomNumber = String(roomNumber).trim();
  if (type !== undefined) classroom.type = String(type).trim();
  if (isEnabled !== undefined) classroom.isEnabled = Boolean(isEnabled);

  if (level !== undefined) {
    const numericLevel = Number(level);
    if (Number.isNaN(numericLevel) || numericLevel <= 0) {
      return res.status(400).json({ message: 'level must be a number greater than 0' });
    }
    if (buildingId) {
      const targetBuilding = await Building.findOne({ code: classroom.buildingCode }).lean();
      if (targetBuilding?.levels && numericLevel > targetBuilding.levels) {
        return res.status(400).json({ message: `Building has only ${targetBuilding.levels} levels` });
      }
    }
    classroom.level = numericLevel;
  }

  if (capacity !== undefined) {
    const numericCapacity = Number(capacity);
    if (Number.isNaN(numericCapacity) || numericCapacity < 0) {
      return res.status(400).json({ message: 'capacity must be a number greater or equal to 0' });
    }
    classroom.capacity = numericCapacity;
  }

  await classroom.save();
  return res.json(toClientClassroom(classroom));
}

export async function deleteClassroom(req, res) {
  const { id } = req.params;
  const classroom = await Classroom.findOne({ code: id });

  if (!classroom) {
    return res.status(404).json({ message: 'Classroom not found' });
  }

  await classroom.deleteOne();
  return res.status(204).send();
}
