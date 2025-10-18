import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import {
  listSections,
  getSection,
  createSection,
  updateSection,
  deleteSection,
} from '../controllers/section.controller.js';

const router = Router();

router.get('/', asyncHandler(listSections));
router.get('/:id', asyncHandler(getSection));
router.post('/', asyncHandler(createSection));
router.put('/:id', asyncHandler(updateSection));
router.delete('/:id', asyncHandler(deleteSection));

export default router;
