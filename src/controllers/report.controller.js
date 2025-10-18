import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import Assignment from '../models/Assignment.js';
import Subject from '../models/Subject.js';
import Teacher from '../models/Teacher.js';
import Classroom from '../models/Classroom.js';
import TimeSlot from '../models/TimeSlot.js';
import Section from '../models/Section.js';
import Jornada from '../models/Jornada.js';
import Building from '../models/Building.js';

function buildFilters(query) {
  const filters = {};
  if (query.period) filters.period = String(query.period).trim();
  if (query.jornadaId) filters.jornadaCode = String(query.jornadaId).trim();
  if (query.teacherId) filters.teacherCode = String(query.teacherId).trim();
  if (query.sectionId) filters.sectionCode = String(query.sectionId).trim();
  if (query.timeSlotId) filters.timeSlotCode = String(query.timeSlotId).trim();
  if (query.classroomId) filters.classroomCode = String(query.classroomId).trim();
  return filters;
}

function mapTeacherName(teacher) {
  if (!teacher) return '';
  const first = teacher.firstName ?? '';
  const last = teacher.lastName ?? '';
  return `${first} ${last}`.trim() || teacher.code;
}

async function fetchAssignmentsWithDetails(query) {
  const filters = buildFilters(query);

  const assignments = await Assignment.find(filters)
    .sort({ period: 1, jornadaCode: 1, timeSlotCode: 1 })
    .lean();

  if (assignments.length === 0) {
    return {
      filters,
      assignments: [],
      references: {},
    };
  }

  const subjectCodes = new Set(assignments.map((item) => item.subjectCode));
  const teacherCodes = new Set(assignments.map((item) => item.teacherCode));
  const classroomCodes = new Set(assignments.map((item) => item.classroomCode));
  const timeSlotCodes = new Set(assignments.map((item) => item.timeSlotCode));
  const sectionCodes = new Set(assignments.map((item) => item.sectionCode));
  const jornadaCodes = new Set(assignments.map((item) => item.jornadaCode));

  const [subjects, teachers, classrooms, timeSlots, sections, jornadas] = await Promise.all([
    Subject.find({ code: { $in: [...subjectCodes] } }).lean(),
    Teacher.find({ code: { $in: [...teacherCodes] } }).lean(),
    Classroom.find({ code: { $in: [...classroomCodes] } }).lean(),
    TimeSlot.find({ code: { $in: [...timeSlotCodes] } }).lean(),
    Section.find({ code: { $in: [...sectionCodes] } }).lean(),
    Jornada.find({ code: { $in: [...jornadaCodes] } }).lean(),
  ]);

  const buildingCodes = [...new Set(classrooms.map((room) => room.buildingCode))];
  const buildings = await Building.find({ code: { $in: buildingCodes } }).lean();

  const subjectMap = new Map(subjects.map((item) => [item.code, item]));
  const teacherMap = new Map(teachers.map((item) => [item.code, item]));
  const classroomMap = new Map(classrooms.map((item) => [item.code, item]));
  const timeSlotMap = new Map(timeSlots.map((item) => [item.code, item]));
  const sectionMap = new Map(sections.map((item) => [item.code, item]));
  const jornadaMap = new Map(jornadas.map((item) => [item.code, item]));
  const buildingMap = new Map(buildings.map((item) => [item.code, item]));

  const detailedAssignments = assignments.map((assignment) => {
    const subject = subjectMap.get(assignment.subjectCode);
    const teacher = teacherMap.get(assignment.teacherCode);
    const classroom = classroomMap.get(assignment.classroomCode);
    const timeSlot = timeSlotMap.get(assignment.timeSlotCode);
    const section = sectionMap.get(assignment.sectionCode);
    const jornada = jornadaMap.get(assignment.jornadaCode);
    const building = classroom ? buildingMap.get(classroom.buildingCode) : null;

    return {
      id: assignment.code,
      period: assignment.period,
      jornada: {
        id: assignment.jornadaCode,
        name: jornada?.name ?? assignment.jornadaCode,
      },
      subject: {
        id: assignment.subjectCode,
        name: subject?.name ?? assignment.subjectCode,
        careerId: subject?.careerCode ?? '',
      },
      teacher: {
        id: assignment.teacherCode,
        name: mapTeacherName(teacher),
      },
      classroom: {
        id: assignment.classroomCode,
        name: classroom?.name ?? assignment.classroomCode,
        level: classroom?.level ?? null,
        buildingId: classroom?.buildingCode ?? '',
        buildingName: building?.name ?? '',
      },
      section: {
        id: assignment.sectionCode,
        name: section?.name ?? assignment.sectionCode,
      },
      timeSlot: {
        id: assignment.timeSlotCode,
        day: timeSlot?.day ?? '',
        start: timeSlot?.start ?? '',
        end: timeSlot?.end ?? '',
      },
      semester: assignment.semester ?? section?.semester ?? null,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  });

  return {
    filters,
    assignments: detailedAssignments,
    references: {
      jornadas: jornadaMap,
      teachers: teacherMap,
      sections: sectionMap,
    },
  };
}

function buildFiltersSummary(filters, references) {
  const summary = [];
  if (filters.period) summary.push(`Periodo: ${filters.period}`);
  if (filters.jornadaCode) {
    const jornada = references.jornadas?.get(filters.jornadaCode);
    summary.push(`Jornada: ${jornada?.name ?? filters.jornadaCode}`);
  }
  if (filters.teacherCode) {
    const teacher = references.teachers?.get(filters.teacherCode);
    summary.push(`Docente: ${mapTeacherName(teacher)} (${filters.teacherCode})`);
  }
  if (filters.sectionCode) {
    const section = references.sections?.get(filters.sectionCode);
    summary.push(`Sección: ${section?.name ?? filters.sectionCode}`);
  }
  if (filters.timeSlotCode) summary.push(`Horario: ${filters.timeSlotCode}`);
  if (filters.classroomCode) summary.push(`Salón: ${filters.classroomCode}`);
  return summary;
}

function createPdf(assignments, metadata) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(18).text('Reporte de Asignaciones', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#555555').text(`Generado: ${new Date().toLocaleString()}`);

    if (metadata.filtersSummary.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#1f2937').text(`Filtros aplicados: ${metadata.filtersSummary.join(' · ')}`);
    }

    doc.moveDown(1);
    doc.fillColor('#111111');

    if (assignments.length === 0) {
      doc.fontSize(12).text('No se encontraron asignaciones para los filtros seleccionados.', { align: 'center' });
      doc.end();
      return;
    }

    assignments.forEach((assignment, index) => {
      doc.fontSize(13).text(`${assignment.period} · ${assignment.jornada.name}`, { continued: false });
      doc.moveDown(0.2);
      doc.fontSize(11).fillColor('#1f2937').text(`Curso: ${assignment.subject.name} (${assignment.subject.id})`);
      doc.fontSize(11).text(`Docente: ${assignment.teacher.name} (${assignment.teacher.id})`);
      doc.fontSize(11).text(`Sección: ${assignment.section.name} (${assignment.section.id}) · Semestre: ${assignment.semester ?? '—'}`);
      doc.fontSize(11).text(
        `Horario: ${assignment.timeSlot.day} ${assignment.timeSlot.start} - ${assignment.timeSlot.end} (${assignment.timeSlot.id})`,
      );

      const classroomParts = [`${assignment.classroom.name} (${assignment.classroom.id})`];
      if (assignment.classroom.buildingName) classroomParts.push(`Edificio: ${assignment.classroom.buildingName}`);
      if (assignment.classroom.level !== null && assignment.classroom.level !== undefined) {
        classroomParts.push(`Nivel: ${assignment.classroom.level}`);
      }
      doc.fontSize(11).text(`Salón: ${classroomParts.join(' · ')}`);

      if (index < assignments.length - 1) {
        doc.moveDown(0.8);
        doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#d1d5db').stroke();
        doc.moveDown(0.6);
      }
    });

    doc.end();
  });
}

async function createExcel(assignments, metadata) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Asignaciones';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Asignaciones');
  sheet.columns = [
    { header: 'Periodo', key: 'period', width: 12 },
    { header: 'Jornada', key: 'jornada', width: 28 },
    { header: 'Horario', key: 'timeSlot', width: 24 },
    { header: 'Curso', key: 'subject', width: 32 },
    { header: 'Docente', key: 'teacher', width: 28 },
    { header: 'Sección', key: 'section', width: 16 },
    { header: 'Semestre', key: 'semester', width: 12 },
    { header: 'Salón', key: 'classroom', width: 28 },
  ];

  sheet.getRow(1).font = { bold: true };

  assignments.forEach((assignment) => {
    sheet.addRow({
      period: assignment.period,
      jornada: `${assignment.jornada.name} (${assignment.jornada.id})`,
      timeSlot: `${assignment.timeSlot.day} ${assignment.timeSlot.start}-${assignment.timeSlot.end}`,
      subject: `${assignment.subject.name} (${assignment.subject.id})`,
      teacher: `${assignment.teacher.name} (${assignment.teacher.id})`,
      section: `${assignment.section.name} (${assignment.section.id})`,
      semester: assignment.semester ?? '',
      classroom: `${assignment.classroom.name} (${assignment.classroom.id})`,
    });
  });

  if (metadata.filtersSummary.length > 0) {
    const infoSheet = workbook.addWorksheet('Resumen');
    infoSheet.addRow(['Reporte de Asignaciones']);
    infoSheet.addRow([`Generado: ${new Date().toLocaleString()}`]);
    infoSheet.addRow([]);
    infoSheet.addRow(['Filtros aplicados']);
    metadata.filtersSummary.forEach((item) => infoSheet.addRow([item]));
    infoSheet.getColumn(1).width = 50;
  }

  return workbook.xlsx.writeBuffer();
}

export async function getAssignmentsReport(req, res) {
  const format = String(req.query.format ?? 'json').toLowerCase();
  const { filters, assignments, references } = await fetchAssignmentsWithDetails(req.query);
  const filtersSummary = buildFiltersSummary(filters, references);

  if (format === 'pdf') {
    const buffer = await createPdf(assignments, { filtersSummary });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-asignaciones-${timestamp}.pdf"`);
    return res.send(buffer);
  }

  if (format === 'excel' || format === 'xlsx' || format === 'xls') {
    const buffer = await createExcel(assignments, { filtersSummary });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="reporte-asignaciones-${timestamp}.xlsx"`);
    return res.send(buffer);
  }

  return res.json({
    filters,
    filtersSummary,
    count: assignments.length,
    items: assignments,
  });
}
