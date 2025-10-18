import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import {
  listFaculties,
  getFaculty,
  createFaculty,
  updateFaculty,
  deleteFaculty,
} from '../controllers/faculty.controller.js';

const router = Router();

router.get('/', asyncHandler(listFaculties));
router.get('/:id', asyncHandler(getFaculty));
router.post('/', asyncHandler(createFaculty));
router.put('/:id', asyncHandler(updateFaculty));
router.delete('/:id', asyncHandler(deleteFaculty));

export default router;
