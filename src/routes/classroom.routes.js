import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import {
  listClassrooms,
  getClassroom,
  createClassroom,
  updateClassroom,
  deleteClassroom,
} from '../controllers/classroom.controller.js';

const router = Router();

router.get('/', asyncHandler(listClassrooms));
router.get('/:id', asyncHandler(getClassroom));
router.post('/', asyncHandler(createClassroom));
router.put('/:id', asyncHandler(updateClassroom));
router.delete('/:id', asyncHandler(deleteClassroom));

export default router;
