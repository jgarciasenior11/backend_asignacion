import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.routes.js';
import { authenticate, authorizeRoles } from './middleware/auth.js';
import facultyRoutes from './routes/faculty.routes.js';
import careerRoutes from './routes/career.routes.js';
import subjectRoutes from './routes/subject.routes.js';
import locationRoutes from './routes/location.routes.js';
import buildingRoutes from './routes/building.routes.js';
import classroomRoutes from './routes/classroom.routes.js';
import sectionRoutes from './routes/section.routes.js';
import jornadaRoutes from './routes/jornada.routes.js';
import timeSlotRoutes from './routes/timeSlot.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import userRoutes from './routes/user.routes.js';
import assignmentRoutes from './routes/assignment.routes.js';
import reportRoutes from './routes/report.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/database-test', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB connection not ready');
    }

    await mongoose.connection.db.admin().ping();
    console.info('MongoDB ping exitoso: conexión activa.');
    res.json({ ok: true, status: 'connected' });
  } catch (error) {
    console.error('MongoDB ping falló:', error.message);
    res.status(500).json({ ok: false, status: 'disconnected', error: error.message });
  }
});

app.use('/api/auth', authRoutes);

app.use(authenticate);

app.use('/api/faculties', facultyRoutes);
app.use('/api/careers', careerRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/jornadas', jornadaRoutes);
app.use('/api/timeslots', timeSlotRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/users', authorizeRoles('admin'), userRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/reports', reportRoutes);

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(error.status || 500).json({
    message: error.message || 'Internal server error',
  });
});

export default app;
