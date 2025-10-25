import User from '../models/User.js';
import Jornada from '../models/Jornada.js';

function toClientUser(doc) {
  return {
    id: doc.code,
    username: doc.username,
    fullName: doc.fullName,
    email: doc.email,
    role: doc.role,
    status: doc.status,
    hasPassword: Boolean(doc.password),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listUsers(req, res) {
  const users = await User.find().sort({ username: 1 }).lean();
  res.json(users.map(toClientUser));
}

export async function getUser(req, res) {
  const { id } = req.params;
  const user = await User.findOne({ code: id }).lean();

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json(toClientUser(user));
}

export async function createUser(req, res) {
  const { id, code, username, fullName, email, role, status, password } = req.body;
  const codeToUse = (code ?? id)?.trim();

  if (!codeToUse || !username || !fullName || !email || !password) {
    return res.status(400).json({ message: 'code/id, username, fullName, email and password are required' });
  }

  const normalizedUsername = username.trim().toLowerCase();

  const [existingCode, existingUsername] = await Promise.all([
    User.findOne({ code: codeToUse }),
    User.findOne({ username: normalizedUsername }),
  ]);

  if (existingCode) {
    return res.status(409).json({ message: 'A user with this code already exists' });
  }

  if (existingUsername) {
    return res.status(409).json({ message: 'A user with this username already exists' });
  }

  const user = await User.create({
    code: codeToUse,
    username: normalizedUsername,
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    role: role ?? 'viewer',
    status: status ?? 'active',
    password: password.trim(),
  });

  return res.status(201).json(toClientUser(user));
}

export async function updateUser(req, res) {
  const { id } = req.params;
  const { code, username, fullName, email, role, status, password } = req.body;

  const user = await User.findOne({ code: id });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  let currentCode = user.code;

  if (code && code.trim() !== user.code) {
    const newCode = code.trim();
    const duplicateCode = await User.findOne({ code: newCode, _id: { $ne: user._id } });
    if (duplicateCode) {
      return res.status(409).json({ message: 'A user with this code already exists' });
    }
    await Jornada.updateMany({ managerId: user.code }, { managerId: newCode });
    user.code = newCode;
    currentCode = newCode;
  }

  if (username) {
    const normalizedUsername = username.trim().toLowerCase();
    if (normalizedUsername !== user.username) {
      const duplicateUsername = await User.findOne({ username: normalizedUsername, _id: { $ne: user._id } });
      if (duplicateUsername) {
        return res.status(409).json({ message: 'A user with this username already exists' });
      }
      user.username = normalizedUsername;
    }
  }

  if (fullName) user.fullName = fullName.trim();
  if (email) user.email = email.trim().toLowerCase();
  const appliedRole = role ?? user.role;
  const appliedStatus = status ?? user.status;
  user.role = appliedRole;
  user.status = appliedStatus;
  if (password && password.trim().length > 0) {
    user.password = password.trim();
  }

  await user.save();
  if (appliedRole !== 'coordinator' || appliedStatus !== 'active') {
    await Jornada.updateMany({ managerId: currentCode }, { managerId: '' });
  }
  return res.json(toClientUser(user));
}

export async function deleteUser(req, res) {
  const { id } = req.params;
  const user = await User.findOne({ code: id });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  await Jornada.updateMany({ managerId: user.code }, { managerId: '' });
  await user.deleteOne();
  return res.status(204).send();
}
