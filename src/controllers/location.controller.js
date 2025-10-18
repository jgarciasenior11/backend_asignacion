import Location from '../models/Location.js';
import Building from '../models/Building.js';
import Classroom from '../models/Classroom.js';
import Jornada from '../models/Jornada.js';
import Section from '../models/Section.js';
import TimeSlot from '../models/TimeSlot.js';

function toClientLocation(doc) {
  return {
    id: doc.code,
    name: doc.name,
    type: doc.type,
    address: doc.address,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listLocations(req, res) {
  const locations = await Location.find().sort({ name: 1 }).lean();
  res.json(locations.map(toClientLocation));
}

export async function getLocation(req, res) {
  const { id } = req.params;
  const location = await Location.findOne({ code: id }).lean();

  if (!location) {
    return res.status(404).json({ message: 'Location not found' });
  }

  return res.json(toClientLocation(location));
}

export async function createLocation(req, res) {
  const { id, code, name, type, address } = req.body;
  const codeToUse = (code ?? id)?.trim();

  if (!codeToUse || !name || !type || !address) {
    return res.status(400).json({ message: 'code/id, name, type and address are required' });
  }

  const existing = await Location.findOne({ code: codeToUse });
  if (existing) {
    return res.status(409).json({ message: 'A location with this code already exists' });
  }

  const location = await Location.create({
    code: codeToUse,
    name: name.trim(),
    type: type.trim(),
    address: address.trim(),
  });

  return res.status(201).json(toClientLocation(location));
}

export async function updateLocation(req, res) {
  const { id } = req.params;
  const { code, name, type, address } = req.body;

  const location = await Location.findOne({ code: id });
  if (!location) {
    return res.status(404).json({ message: 'Location not found' });
  }

  if (code && code.trim() !== location.code) {
    const newCode = code.trim();
    const duplicate = await Location.findOne({ code: newCode, _id: { $ne: location._id } });
    if (duplicate) {
      return res.status(409).json({ message: 'A location with this code already exists' });
    }
    await Building.updateMany({ locationCode: location.code }, { locationCode: newCode });
    await Jornada.updateMany({ locationCode: location.code }, { locationCode: newCode });
    location.code = newCode;
  }

  if (name) location.name = name.trim();
  if (type) location.type = type.trim();
  if (address) location.address = address.trim();

  await location.save();
  return res.json(toClientLocation(location));
}

export async function deleteLocation(req, res) {
  const { id } = req.params;
  const location = await Location.findOne({ code: id });

  if (!location) {
    return res.status(404).json({ message: 'Location not found' });
  }

  const buildingCodes = await Building.find({ locationCode: location.code }).distinct('code');
  await Building.deleteMany({ locationCode: location.code });
  if (buildingCodes.length > 0) {
    await Classroom.deleteMany({ buildingCode: { $in: buildingCodes } });
  }
  const jornadaCodes = await Jornada.find({ locationCode: location.code }).distinct('code');
  await Jornada.deleteMany({ locationCode: location.code });
  if (jornadaCodes.length > 0) {
    await Section.deleteMany({ jornadaCode: { $in: jornadaCodes } });
    await TimeSlot.deleteMany({ jornadaCode: { $in: jornadaCodes } });
  }
  await location.deleteOne();
  return res.status(204).send();
}
