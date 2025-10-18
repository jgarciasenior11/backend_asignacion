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

export async function listTimeSlots(req, res) {
  const { jornadaId } = req.query;
  const filter = {};
  if (jornadaId) {
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

    if (code && code.trim() !== timeSlot.code) {
      const newCode = code.trim();
      const duplicate = await TimeSlot.findOne({ code: newCode, _id: { $ne: timeSlot._id } });
      if (duplicate) {
        return res.status(409).json({ message: 'A time slot with this code already exists' });
      }
      timeSlot.code = newCode;
    }

    if (jornadaId && jornadaId.trim() !== timeSlot.jornadaCode) {
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

  await timeSlot.deleteOne();
  return res.status(204).send();
}
