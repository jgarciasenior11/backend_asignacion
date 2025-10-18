import Building from '../models/Building.js';
import Location from '../models/Location.js';
import Classroom from '../models/Classroom.js';

function toClientBuilding(doc) {
  return {
    id: doc.code,
    name: doc.name,
    description: doc.description ?? '',
    locationId: doc.locationCode,
    levels: doc.levels ?? 1,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listBuildings(req, res) {
  const { locationId } = req.query;

  const filter = {};
  if (locationId) {
    filter.locationCode = locationId;
  }

  const buildings = await Building.find(filter).sort({ name: 1 }).lean();
  res.json(buildings.map(toClientBuilding));
}

export async function getBuilding(req, res) {
  const { id } = req.params;
  const building = await Building.findOne({ code: id }).lean();

  if (!building) {
    return res.status(404).json({ message: 'Building not found' });
  }

  return res.json(toClientBuilding(building));
}

export async function createBuilding(req, res) {
  const { id, code, name, description, locationId, levels } = req.body;
  const codeToUse = (code ?? id)?.trim();

  if (!codeToUse || !name || !locationId) {
    return res.status(400).json({ message: 'code/id, name and locationId are required' });
  }

  const locationExists = await Location.exists({ code: locationId.trim() });
  if (!locationExists) {
    return res.status(400).json({ message: 'Referenced location does not exist' });
  }

  const existing = await Building.findOne({ code: codeToUse });
  if (existing) {
    return res.status(409).json({ message: 'A building with this code already exists' });
  }

  const building = await Building.create({
    code: codeToUse,
    name: name.trim(),
    description: description?.trim(),
    locationCode: locationId.trim(),
    levels: Number(levels) > 0 ? Number(levels) : 1,
  });

  return res.status(201).json(toClientBuilding(building));
}

export async function updateBuilding(req, res) {
  const { id } = req.params;
  const { code, name, description, locationId, levels } = req.body;

  const building = await Building.findOne({ code: id });
  if (!building) {
    return res.status(404).json({ message: 'Building not found' });
  }

  if (code && code.trim() !== building.code) {
    const duplicate = await Building.findOne({ code: code.trim(), _id: { $ne: building._id } });
    if (duplicate) {
      return res.status(409).json({ message: 'A building with this code already exists' });
    }
    const newCode = code.trim();
    await Classroom.updateMany({ buildingCode: building.code }, { buildingCode: newCode });
    building.code = newCode;
  }

  if (name) building.name = name.trim();
  if (typeof description === 'string') building.description = description.trim();

  if (locationId && locationId.trim() !== building.locationCode) {
    const locationExists = await Location.exists({ code: locationId.trim() });
    if (!locationExists) {
      return res.status(400).json({ message: 'Referenced location does not exist' });
    }
    building.locationCode = locationId.trim();
  }

  if (levels !== undefined) {
    const numericLevels = Number(levels);
    if (Number.isNaN(numericLevels) || numericLevels <= 0) {
      return res.status(400).json({ message: 'levels must be a number greater than 0' });
    }
    building.levels = numericLevels;
  }

  await building.save();
  return res.json(toClientBuilding(building));
}

export async function deleteBuilding(req, res) {
  const { id } = req.params;
  const building = await Building.findOne({ code: id });

  if (!building) {
    return res.status(404).json({ message: 'Building not found' });
  }

  await Classroom.deleteMany({ buildingCode: building.code });
  await building.deleteOne();
  return res.status(204).send();
}
