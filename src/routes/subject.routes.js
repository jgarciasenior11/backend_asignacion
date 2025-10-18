import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import {
  listSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
} from '../controllers/subject.controller.js';

const router = Router();

router.get('/', asyncHandler(listSubjects));
router.get('/:id', asyncHandler(getSubject));
router.post('/', asyncHandler(createSubject));
router.put('/:id', asyncHandler(updateSubject));
router.delete('/:id', asyncHandler(deleteSubject));

export default router;
