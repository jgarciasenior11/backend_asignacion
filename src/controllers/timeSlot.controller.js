import TimeSlot from '../models/TimeSlot.js';
import Jornada from '../models/Jornada.js';

function toClientTimeSlot(doc) {
  return {
    id: doc.code,
    day: doc.day,
    start: doc.start,
    end: doc.end,
    jornadaId: doc.jornadaCode,
    createdBy: doc.createdBy ?? '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

async function ensureJornada(jornadaId) {
  if (!jornadaId) return;
  const exists = await Jornada.exists({ code: jornadaId.trim() });
  if (!exists) {
    throw new Error('Referenced jornada does not exist');
  }
}

async function getCoordinatorJornadaCodes(user) {
  if (!user || user.role !== 'coordinator') return null;

  const jornadas = await Jornada.find({ managerId: user.id }).select('code').lean();
  const codes = new Set(
    jornadas
      .map((jornada) => jornada.code)
      .filter((code) => typeof code === 'string' && code.trim().length > 0)
      .map((code) => code.trim()),
  );

  return Array.from(codes);
}

function ensureCoordinatorHasAccess(res, allowedCodes, jornadaId) {
  if (!Array.isArray(allowedCodes)) {
    return true;
  }

  if (allowedCodes.length === 0 || !allowedCodes.includes(jornadaId?.trim())) {
    res.status(403).json({ message: 'You do not have permission to manage this jornada' });
    return false;
  }

  return true;
}

export async function listTimeSlots(req, res) {
  const { jornadaId } = req.query;
  const filter = {};
  let allowedJornadas = null;

  if (req.user?.role === 'coordinator') {
    allowedJornadas = await getCoordinatorJornadaCodes(req.user);
    if (!allowedJornadas || allowedJornadas.length === 0) {
      return res.json([]);
    }
    filter.jornadaCode = { $in: allowedJornadas };
  }

  if (jornadaId) {
    if (Array.isArray(allowedJornadas) && !ensureCoordinatorHasAccess(res, allowedJornadas, jornadaId)) {
      return;
    }
    filter.jornadaCode = jornadaId;
  }
  const timeSlots = await TimeSlot.find(filter).sort({ day: 1, start: 1 }).lean();
  res.json(timeSlots.map(toClientTimeSlot));
}

export async function getTimeSlot(req, res) {
  const { id } = req.params;
  const timeSlot = await TimeSlot.findOne({ code: id }).lean();
  if (!timeSlot) {
    return res.status(404).json({ message: 'Time slot not found' });
  }

  if (req.user?.role === 'coordinator') {
    const allowedJornadas = await getCoordinatorJornadaCodes(req.user);
    if (!ensureCoordinatorHasAccess(res, allowedJornadas, timeSlot.jornadaCode)) {
      return;
    }
  }

  return res.json(toClientTimeSlot(timeSlot));
}

export async function createTimeSlot(req, res) {
  try {
    const { id, code, day, start, end, jornadaId, createdBy } = req.body;
    const codeToUse = (code ?? id)?.trim();

    if (!codeToUse || !day || !start || !end || !jornadaId) {
      return res.status(400).json({ message: 'code/id, day, start, end and jornadaId are required' });
    }

    const duplicate = await TimeSlot.findOne({ code: codeToUse });
    if (duplicate) {
      return res.status(409).json({ message: 'A time slot with this code already exists' });
    }

    const allowedJornadas = await getCoordinatorJornadaCodes(req.user);
    if (!ensureCoordinatorHasAccess(res, allowedJornadas, jornadaId)) {
      return;
    }

    await ensureJornada(jornadaId);

    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return res.status(400).json({ message: 'Invalid start/end times' });
    }

    const timeSlot = await TimeSlot.create({
      code: codeToUse,
      day: day.trim(),
      start: start.trim(),
      end: end.trim(),
      jornadaCode: jornadaId.trim(),
      createdBy: createdBy?.trim() ?? '',
    });

    return res.status(201).json(toClientTimeSlot(timeSlot));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function updateTimeSlot(req, res) {
  try {
    const { id } = req.params;
    const { code, day, start, end, jornadaId, createdBy } = req.body;

    const timeSlot = await TimeSlot.findOne({ code: id });
    if (!timeSlot) {
      return res.status(404).json({ message: 'Time slot not found' });
    }

    const allowedJornadas = await getCoordinatorJornadaCodes(req.user);
    if (!ensureCoordinatorHasAccess(res, allowedJornadas, timeSlot.jornadaCode)) {
      return;
    }

    if (code && code.trim() !== timeSlot.code) {
      const newCode = code.trim();
      const duplicate = await TimeSlot.findOne({ code: newCode, _id: { $ne: timeSlot._id } });
      if (duplicate) {
        return res.status(409).json({ message: 'A time slot with this code already exists' });
      }
      timeSlot.code = newCode;
    }

    if (jornadaId && jornadaId.trim() !== timeSlot.jornadaCode) {
      if (!ensureCoordinatorHasAccess(res, allowedJornadas, jornadaId)) {
        return;
      }
      await ensureJornada(jornadaId);
      timeSlot.jornadaCode = jornadaId.trim();
    }

    if (day) timeSlot.day = day.trim();
    if (start) timeSlot.start = start.trim();
    if (end) timeSlot.end = end.trim();
    if (createdBy !== undefined) timeSlot.createdBy = createdBy?.trim() ?? '';

    const startMinutes = toMinutes(timeSlot.start);
    const endMinutes = toMinutes(timeSlot.end);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return res.status(400).json({ message: 'Invalid start/end times' });
    }

    await timeSlot.save();
    return res.json(toClientTimeSlot(timeSlot));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function deleteTimeSlot(req, res) {
  const { id } = req.params;
  const timeSlot = await TimeSlot.findOne({ code: id });

  if (!timeSlot) {
    return res.status(404).json({ message: 'Time slot not found' });
  }

  const allowedJornadas = await getCoordinatorJornadaCodes(req.user);
  if (!ensureCoordinatorHasAccess(res, allowedJornadas, timeSlot.jornadaCode)) {
    return;
  }

  await timeSlot.deleteOne();
  return res.status(204).send();
}
