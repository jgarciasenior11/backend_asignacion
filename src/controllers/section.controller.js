import Section from '../models/Section.js';
import Jornada from '../models/Jornada.js';
import User from '../models/User.js';

function toClientSection(doc) {
  return {
    id: doc.code,
    name: doc.name,
    status: doc.status ?? 'active',
    jornadaId: doc.jornadaCode,
    capacity: doc.capacity ?? 0,
    semester: doc.semester ?? 1,
    createdBy: doc.createdBy ?? '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function ensureJornada(jornadaId) {
  if (!jornadaId) return;
  const exists = await Jornada.exists({ code: jornadaId.trim() });
  if (!exists) {
    throw new Error('Referenced jornada does not exist');
  }
}

async function ensureCoordinator(userId) {
  if (!userId) return;
  const user = await User.findOne({ code: userId.trim() });
  if (!user || user.role !== 'coordinator' || user.status !== 'active') {
    throw new Error('createdBy must be an active coordinator');
  }
}

export async function listSections(req, res) {
  const { jornadaId } = req.query;
  const filter = {};
  if (jornadaId) {
    filter.jornadaCode = jornadaId;
  }
  const sections = await Section.find(filter).sort({ name: 1 }).lean();
  res.json(sections.map(toClientSection));
}

export async function getSection(req, res) {
  const { id } = req.params;
  const section = await Section.findOne({ code: id }).lean();
  if (!section) {
    return res.status(404).json({ message: 'Section not found' });
  }
  return res.json(toClientSection(section));
}

export async function createSection(req, res) {
  try {
    const { id, code, name, status, jornadaId, capacity, semester, createdBy } = req.body;
    const codeToUse = (code ?? id)?.trim();

    if (!codeToUse || !name || !jornadaId) {
      return res.status(400).json({ message: 'code/id, name and jornadaId are required' });
    }

    const existing = await Section.findOne({ code: codeToUse });
    if (existing) {
      return res.status(409).json({ message: 'A section with this code already exists' });
    }

    await ensureJornada(jornadaId);
    if (createdBy) {
      await ensureCoordinator(createdBy);
    }

    const numericCapacity = Number(capacity);
    if (Number.isNaN(numericCapacity) || numericCapacity <= 0) {
      return res.status(400).json({ message: 'capacity must be a number greater than 0' });
    }

    const numericSemester = Number(semester ?? 1);
    if (Number.isNaN(numericSemester) || numericSemester < 1 || numericSemester > 12) {
      return res.status(400).json({ message: 'semester must be a number between 1 and 12' });
    }

    const section = await Section.create({
      code: codeToUse,
      name: name.trim(),
      status: status ?? 'active',
      jornadaCode: jornadaId.trim(),
      capacity: numericCapacity,
      semester: numericSemester,
      createdBy: createdBy?.trim() ?? '',
    });

    return res.status(201).json(toClientSection(section));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function updateSection(req, res) {
  try {
    const { id } = req.params;
    const { code, name, status, jornadaId, capacity, semester, createdBy } = req.body;

    const section = await Section.findOne({ code: id });
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    if (code && code.trim() !== section.code) {
      const newCode = code.trim();
      const duplicate = await Section.findOne({ code: newCode, _id: { $ne: section._id } });
      if (duplicate) {
        return res.status(409).json({ message: 'A section with this code already exists' });
      }
      section.code = newCode;
    }

    if (jornadaId && jornadaId.trim() !== section.jornadaCode) {
      await ensureJornada(jornadaId);
      section.jornadaCode = jornadaId.trim();
    }

    if (createdBy !== undefined) {
      if (createdBy.trim() === '') {
        section.createdBy = '';
      } else {
        await ensureCoordinator(createdBy);
        section.createdBy = createdBy.trim();
      }
    }

    if (name) section.name = name.trim();
    if (status) section.status = status;

    if (capacity !== undefined) {
      const numericCapacity = Number(capacity);
      if (Number.isNaN(numericCapacity) || numericCapacity <= 0) {
        return res.status(400).json({ message: 'capacity must be a number greater than 0' });
      }
      section.capacity = numericCapacity;
    }

    if (semester !== undefined) {
      const numericSemester = Number(semester);
      if (Number.isNaN(numericSemester) || numericSemester < 1 || numericSemester > 12) {
        return res.status(400).json({ message: 'semester must be a number between 1 and 12' });
      }
      section.semester = numericSemester;
    }

    await section.save();
    return res.json(toClientSection(section));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function deleteSection(req, res) {
  const { id } = req.params;
  const section = await Section.findOne({ code: id });

  if (!section) {
    return res.status(404).json({ message: 'Section not found' });
  }

  await section.deleteOne();
  return res.status(204).send();
}
