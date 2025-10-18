import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import {
  listCareers,
  getCareer,
  createCareer,
  updateCareer,
  deleteCareer,
} from '../controllers/career.controller.js';

const router = Router();

router.get('/', asyncHandler(listCareers));
router.get('/:id', asyncHandler(getCareer));
router.post('/', asyncHandler(createCareer));
router.put('/:id', asyncHandler(updateCareer));
router.delete('/:id', asyncHandler(deleteCareer));

export default router;
