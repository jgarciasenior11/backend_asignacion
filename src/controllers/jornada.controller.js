import Jornada from '../models/Jornada.js';
import Location from '../models/Location.js';
import Career from '../models/Career.js';
import User from '../models/User.js';
import Section from '../models/Section.js';
import TimeSlot from '../models/TimeSlot.js';

function toClientJornada(doc) {
  return {
    id: doc.code,
    name: doc.name,
    status: doc.status ?? 'active',
    locationId: doc.locationCode,
    careerId: doc.careerCode,
    description: doc.description ?? '',
    managerId: doc.managerId ?? '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function ensureLocation(locationId) {
  if (!locationId) return;
  const exists = await Location.exists({ code: locationId.trim() });
  if (!exists) {
    throw new Error('Referenced location does not exist');
  }
}

async function ensureCareer(careerId) {
  if (!careerId) return;
  const exists = await Career.exists({ code: careerId.trim() });
  if (!exists) {
    throw new Error('Referenced career does not exist');
  }
}

async function ensureCoordinator(managerId) {
  if (!managerId) return;
  const manager = await User.findOne({ code: managerId.trim() });
  if (!manager) {
    throw new Error('Referenced manager does not exist');
  }
  if (manager.role !== 'coordinator' || manager.status !== 'active') {
    throw new Error('Manager must be an active coordinator');
  }
}

export async function listJornadas(req, res) {
  const jornadas = await Jornada.find().sort({ name: 1 }).lean();
  res.json(jornadas.map(toClientJornada));
}

export async function getJornada(req, res) {
  const { id } = req.params;
  const jornada = await Jornada.findOne({ code: id }).lean();
  if (!jornada) {
    return res.status(404).json({ message: 'Jornada not found' });
  }
  return res.json(toClientJornada(jornada));
}

export async function createJornada(req, res) {
  try {
    const { id, code, name, status, locationId, careerId, description, managerId } = req.body;
    const codeToUse = (code ?? id)?.trim();

    if (!codeToUse || !name || !locationId || !careerId) {
      return res.status(400).json({ message: 'code/id, name, locationId and careerId are required' });
    }

    const existing = await Jornada.findOne({ code: codeToUse });
    if (existing) {
      return res.status(409).json({ message: 'A jornada with this code already exists' });
    }

    await Promise.all([ensureLocation(locationId), ensureCareer(careerId), ensureCoordinator(managerId)]);

    const jornada = await Jornada.create({
      code: codeToUse,
      name: name.trim(),
      status: status ?? 'active',
      locationCode: locationId.trim(),
      careerCode: careerId.trim(),
      description: description?.trim(),
      managerId: managerId?.trim() ?? '',
    });

    return res.status(201).json(toClientJornada(jornada));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function updateJornada(req, res) {
  try {
    const { id } = req.params;
    const { code, name, status, locationId, careerId, description, managerId } = req.body;

    const jornada = await Jornada.findOne({ code: id });
    if (!jornada) {
      return res.status(404).json({ message: 'Jornada not found' });
    }

    if (code && code.trim() !== jornada.code) {
      const newCode = code.trim();
      const duplicate = await Jornada.findOne({ code: newCode, _id: { $ne: jornada._id } });
      if (duplicate) {
        return res.status(409).json({ message: 'A jornada with this code already exists' });
      }
      await Promise.all([
        Section.updateMany({ jornadaCode: jornada.code }, { jornadaCode: newCode }),
        TimeSlot.updateMany({ jornadaCode: jornada.code }, { jornadaCode: newCode }),
      ]);
      jornada.code = newCode;
    }

    if (locationId && locationId.trim() !== jornada.locationCode) {
      await ensureLocation(locationId);
      jornada.locationCode = locationId.trim();
    }

    if (careerId && careerId.trim() !== jornada.careerCode) {
      await ensureCareer(careerId);
      jornada.careerCode = careerId.trim();
    }

    if (managerId !== undefined) {
      if (managerId.trim() === '') {
        jornada.managerId = '';
      } else {
        await ensureCoordinator(managerId);
        jornada.managerId = managerId.trim();
      }
    }

    if (name) jornada.name = name.trim();
    if (description !== undefined) jornada.description = description?.trim() ?? '';
    if (status) jornada.status = status;

    await jornada.save();
    return res.json(toClientJornada(jornada));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function deleteJornada(req, res) {
  const { id } = req.params;
  const jornada = await Jornada.findOne({ code: id });

  if (!jornada) {
    return res.status(404).json({ message: 'Jornada not found' });
  }

  await Section.deleteMany({ jornadaCode: jornada.code });
  await TimeSlot.deleteMany({ jornadaCode: jornada.code });
  await jornada.deleteOne();
  return res.status(204).send();
}
