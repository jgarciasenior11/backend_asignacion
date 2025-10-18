import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import {
  listTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  deleteTeacher,
} from '../controllers/teacher.controller.js';

const router = Router();

router.get('/', asyncHandler(listTeachers));
router.get('/:id', asyncHandler(getTeacher));
router.post('/', asyncHandler(createTeacher));
router.put('/:id', asyncHandler(updateTeacher));
router.delete('/:id', asyncHandler(deleteTeacher));

export default router;
