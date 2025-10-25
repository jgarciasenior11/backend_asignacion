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
import Career from '../models/Career.js';

const DAY_ORDER = {
  Lunes: 0,
  Martes: 1,
  Miércoles: 2,
  Jueves: 3,
  Viernes: 4,
  Sábado: 5,
  Domingo: 6,
};

async function resolveCoordinatorScopes(user) {
  if (!user || user.role !== 'coordinator') {
    return {
      jornadaCodes: null,
      careerCodes: null,
    };
  }

  const jornadas = await Jornada.find({ managerId: user.id }).select('code careerCode').lean();
  const jornadaCodes = new Set();
  const careerCodes = new Set();

  jornadas.forEach((jornada) => {
    if (jornada.code) {
      jornadaCodes.add(jornada.code.trim());
    }
    if (jornada.careerCode) {
      careerCodes.add(jornada.careerCode.trim());
    }
  });

  return {
    jornadaCodes: [...jornadaCodes],
    careerCodes: [...careerCodes],
  };
}

function assertAccessToValue(list, value, entityName) {
  if (!Array.isArray(list)) {
    return;
  }

  if (list.length === 0) {
    const error = new Error(`No ${entityName} disponibles para el coordinador actual.`);
    error.status = 403;
    throw error;
  }

  if (value && !list.includes(value.trim())) {
    const error = new Error(`No tienes permisos para acceder a ${entityName} solicitada.`);
    error.status = 403;
    throw error;
  }
}

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

async function fetchAssignmentsWithDetails(query, allowedJornadas = null) {
  const filters = buildFilters(query);

  if (Array.isArray(allowedJornadas)) {
    if (allowedJornadas.length === 0) {
      return {
        filters,
        assignments: [],
        references: {},
      };
    }

    if (filters.jornadaCode) {
      if (!allowedJornadas.includes(filters.jornadaCode)) {
        return {
          filters,
          assignments: [],
          references: {},
        };
      }
    } else {
      filters.jornadaCode = { $in: allowedJornadas };
    }
  }

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
  if (typeof filters.jornadaCode === 'string') {
    const jornada = references.jornadas?.get(filters.jornadaCode);
    summary.push(`Jornada: ${jornada?.name ?? filters.jornadaCode}`);
  } else if (filters.jornadaCode && filters.jornadaCode.$in) {
    summary.push('Jornadas: múltiples');
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
    const doc = new PDFDocument({ margin: 45, size: 'LETTER', layout: 'landscape' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const columnWidths = [90, 200, 160, 120, 200];
    const alignments = ['left', 'left', 'left', 'left', 'left'];
    const baseFontSize = 10;

    const drawRow = (cells, { header = false } = {}) => {
      let x = doc.page.margins.left;
      let y = doc.y;
      const paddingY = header ? 12 : 9;
      let rowHeight = paddingY;

      cells.forEach((cell, index) => {
        const width = columnWidths[index];
        const measured = doc.heightOfString(cell, {
          width: width - 6,
          align: alignments[index],
        });
        rowHeight = Math.max(rowHeight, measured + (header ? 14 : 12));
      });

      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage({ margin: 45, size: 'LETTER', layout: 'portrait' });
        x = doc.page.margins.left;
        y = doc.y;
      }

      doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(header ? baseFontSize : baseFontSize - 1);

      cells.forEach((cell, index) => {
        const width = columnWidths[index];
        doc
          .rect(x, y, width, rowHeight)
          .fillAndStroke(header ? '#1d4ed8' : '#ffffff', header ? '#1d4ed8' : '#d1d5db')
          .fillColor(header ? '#ffffff' : '#0f172a');
        doc.text(cell, x + 3, y + (header ? 4 : 6), {
          width: width - 6,
          align: alignments[index],
        });
        x += width;
      });

      doc.y = y + rowHeight;
      doc.x = doc.page.margins.left;
      doc.fillColor('#0f172a');
    };

    doc.font('Helvetica-Bold').fontSize(18).text('Reporte de Asignaciones', { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10).fillColor('#555555').text(`Generado: ${new Date().toLocaleString()}`, {
      align: 'center',
    });

    if (metadata.filtersSummary.length > 0) {
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10).fillColor('#1f2937').text(`Filtros aplicados: ${metadata.filtersSummary.join(' · ')}`, {
        align: 'center',
      });
    }

    doc.moveDown(0.8);
    doc.fillColor('#111111');

    if (assignments.length === 0) {
      doc.font('Helvetica').fontSize(12).text('No se encontraron asignaciones para los filtros seleccionados.', {
        align: 'center',
      });
      doc.end();
      return;
    }

    const filtersInput = metadata.filters ?? {};
    const includeJornadas = !filtersInput.jornadaId;
    const includeSemesters = !filtersInput.semester;
    const includeSections = !filtersInput.sectionId;

    const groupedAssignments = groupAssignments(assignments, {
      includeSemesters,
      includeSections,
    });

    groupedAssignments.forEach((jornadaGroup, jornadaIndex) => {
      if (includeJornadas || groupedAssignments.length > 1 || jornadaIndex === 0) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(`Jornada: ${jornadaGroup.jornada.name} (${jornadaGroup.jornada.id})`);
        doc.moveDown(0.3);
      }

      jornadaGroup.semesters.forEach((semesterGroup) => {
        const showSemesterHeader = includeSemesters || jornadaGroup.semesters.length > 1;
        if (showSemesterHeader) {
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(formatSemesterLabel(semesterGroup.semester));
          doc.moveDown(0.2);
        }

        semesterGroup.sections.forEach((sectionGroup) => {
          const showSectionHeader = includeSections || semesterGroup.sections.length > 1;
          if (showSectionHeader) {
            doc
              .font('Helvetica-Bold')
              .fontSize(10)
              .fillColor('#1f2937')
              .text(`Sección: ${sectionGroup.section?.name ?? sectionGroup.section?.id ?? '—'}`);
            doc.moveDown(0.15);
          }

          doc.font('Helvetica-Bold').fontSize(baseFontSize);
          drawRow(['Periodo', 'Curso', 'Docente', 'Horario', 'Salón'], { header: true });

          doc.font('Helvetica').fontSize(baseFontSize - 1);
          sectionGroup.assignments.forEach((assignment) => {
            drawRow([
              assignment.period,
              `${assignment.subject.name}\n${assignment.subject.id}`,
              `${assignment.teacher.name} (${assignment.teacher.id})`,
              `${assignment.timeSlot.day} ${assignment.timeSlot.start}-${assignment.timeSlot.end} (${assignment.timeSlot.id})`,
              `${assignment.classroom.name} (${assignment.classroom.id})`,
            ]);
          });

          doc.moveDown(0.5);
        });
      });

      doc.moveDown(0.6);
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

function groupSubjectsBySemester(subjects) {
  const groups = new Map();
  subjects.forEach((subject) => {
    const semesterKey = subject.semester ?? null;
    if (!groups.has(semesterKey)) {
      groups.set(semesterKey, []);
    }
    groups.get(semesterKey).push(subject);
  });

  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

  return sortedKeys.map((key) => ({
    semester: key,
    subjects: groups.get(key).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

function formatSemesterLabel(semester) {
  if (semester === null || semester === undefined) return 'Sin semestre';
  return `Semestre ${semester}`;
}

function formatCredits(subject) {
  if (subject.definitionType === 'credits' && typeof subject.credits === 'number') {
    return String(subject.credits);
  }
  return '—';
}

function formatPrerequisite(subject) {
  return subject.dependsOn?.trim() || '—';
}

async function createCoursesPdf(subjects, metadata) {
  const grouped = groupSubjectsBySemester(subjects);

  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40, size: 'LETTER', layout: 'portrait' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const headerFontSize = 16;
    const bodyFontSize = 10;
    const columnWidths = [110, 260, 80, 120];
    const alignments = ['left', 'left', 'center', 'left'];

    const drawRow = (cells, { header = false } = {}) => {
      let x = doc.page.margins.left;
      let y = doc.y;
      const paddingY = header ? 12 : 9;
      let rowHeight = paddingY;

      cells.forEach((cell, index) => {
        const width = columnWidths[index];
        const measured = doc.heightOfString(cell, {
          width: width - 8,
          align: alignments[index],
        });
        rowHeight = Math.max(rowHeight, measured + (header ? 14 : 12));
      });

      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage({ margin: 40, size: 'LETTER', layout: 'portrait' });
        x = doc.page.margins.left;
        y = doc.y;
      }

      x = doc.page.margins.left;
      cells.forEach((cell, index) => {
        const width = columnWidths[index];
    doc
      .rect(x, y, width, rowHeight)
      .fillAndStroke(header ? '#1d4ed8' : '#ffffff', header ? '#1d4ed8' : '#cbd5f5')
      .fillColor(header ? '#ffffff' : '#0f172a');
    doc.text(cell, x + 4, y + (header ? 4 : 6), {
      width: width - 8,
      align: alignments[index],
    });
    x += width;
  });

  doc.y = y + rowHeight;
  doc.x = doc.page.margins.left;
  doc.fillColor('#0f172a');
};

    doc.font('Helvetica-Bold').fontSize(headerFontSize).text(`Cursos de ${metadata.careerName ?? metadata.careerId}`, {
      align: 'center',
    });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10).fillColor('#475569').text(`Generado: ${new Date().toLocaleString()}`, {
      align: 'center',
    });
    doc.moveDown(0.8);

    if (grouped.length === 0) {
      doc.font('Helvetica').fontSize(12).fillColor('#1f2937').text('No se encontraron cursos para la carrera seleccionada.', {
        align: 'center',
      });
      doc.end();
      return;
    }

    grouped.forEach((group, index) => {
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(formatSemesterLabel(group.semester));
      doc.moveDown(0.3);

      doc.font('Helvetica-Bold').fontSize(bodyFontSize);
      drawRow(['Código', 'Nombre', 'Créditos', 'Prerequisito'], { header: true });

      doc.font('Helvetica').fontSize(bodyFontSize - 1);
      group.subjects.forEach((subject) => {
        drawRow([
          subject.code,
          subject.name,
          formatCredits(subject),
          formatPrerequisite(subject),
        ]);
      });

      if (index < grouped.length - 1) {
        doc.moveDown(0.6);
      }
    });

    doc.end();
  });
}

async function createCoursesExcel(subjects, metadata) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Asignaciones';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(metadata.careerName ?? 'Cursos');
  sheet.columns = [
    { header: 'Semestre', key: 'semester', width: 12 },
    { header: 'Código', key: 'code', width: 16 },
    { header: 'Nombre', key: 'name', width: 42 },
    { header: 'Créditos', key: 'credits', width: 12 },
    { header: 'Prerequisito', key: 'prerequisite', width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  const grouped = groupSubjectsBySemester(subjects);
  grouped.forEach((group) => {
    group.subjects.forEach((subject) => {
      sheet.addRow({
        semester: group.semester ?? '',
        code: subject.code,
        name: subject.name,
        credits: formatCredits(subject),
        prerequisite: formatPrerequisite(subject),
      });
    });
  });

  const infoSheet = workbook.addWorksheet('Resumen');
  infoSheet.addRow(['Reporte de Cursos']);
  infoSheet.addRow([`Carrera: ${metadata.careerName ?? metadata.careerId}`]);
  infoSheet.addRow([`Generado: ${new Date().toLocaleString()}`]);
  infoSheet.getColumn(1).width = 50;

  return workbook.xlsx.writeBuffer();
}

function groupAssignments(assignments, { includeSemesters, includeSections }) {
  const sortAssignments = [...assignments].sort((a, b) => {
    const jornadaCompare = (a.jornada.name ?? a.jornada.id ?? '').localeCompare(b.jornada.name ?? b.jornada.id ?? '');
    if (jornadaCompare !== 0) return jornadaCompare;
    const semesterCompare = (a.semester ?? Number.MAX_SAFE_INTEGER) - (b.semester ?? Number.MAX_SAFE_INTEGER);
    if (semesterCompare !== 0) return semesterCompare;
    const sectionCompare = (a.section.name ?? a.section.id ?? '').localeCompare(b.section.name ?? b.section.id ?? '');
    if (sectionCompare !== 0) return sectionCompare;
    return (a.subject.name ?? a.subject.id ?? '').localeCompare(b.subject.name ?? b.subject.id ?? '');
  });

  const groups = [];

  sortAssignments.forEach((assignment) => {
    let jornadaGroup = groups.find((group) => group.jornada.id === assignment.jornada.id);
    if (!jornadaGroup) {
      jornadaGroup = {
        jornada: assignment.jornada,
        semesters: [],
      };
      groups.push(jornadaGroup);
    }

    const semesterKey = assignment.semester ?? null;
    let semesterGroup = jornadaGroup.semesters.find((group) => group.semester === semesterKey);
    if (!semesterGroup) {
      semesterGroup = {
        semester: semesterKey,
        sections: [],
      };
      jornadaGroup.semesters.push(semesterGroup);
    }

    const sectionKey = assignment.section?.id ?? '';
    let sectionGroup = semesterGroup.sections.find((group) => group.section?.id === sectionKey);
    if (!sectionGroup) {
      sectionGroup = {
        section: assignment.section,
        assignments: [],
      };
      semesterGroup.sections.push(sectionGroup);
    }

    sectionGroup.assignments.push(assignment);
  });

  return groups;
}

function sortTimeSlots(slots) {
  return [...slots].sort((a, b) => {
    const orderA = DAY_ORDER[a.day] ?? 10;
    const orderB = DAY_ORDER[b.day] ?? 10;
    if (orderA !== orderB) return orderA - orderB;
    return (a.start ?? '').localeCompare(b.start ?? '');
  });
}

function buildJornadaMatrix(assignments, timeSlots) {
  const slotOrder = sortTimeSlots(
    timeSlots.map((slot) => ({
      id: slot.code,
      day: slot.day,
      start: slot.start,
      end: slot.end,
    })),
  );

  const teacherMap = new Map();
  assignments.forEach((assignment) => {
    const teacherId = assignment.teacher.id;
    if (!teacherMap.has(teacherId)) {
      teacherMap.set(teacherId, {
        teacher: assignment.teacher,
        slots: new Map(),
      });
    }
    teacherMap.get(teacherId).slots.set(assignment.timeSlot.id, assignment);
  });

  const teachers = [...teacherMap.values()].sort((a, b) =>
    a.teacher.name.localeCompare(b.teacher.name) || a.teacher.id.localeCompare(b.teacher.id),
  );

  return {
    slots: slotOrder,
    teachers,
  };
}

async function createJornadaMatrixPdf(assignments, timeSlots, metadata) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 36, size: 'LETTER', layout: 'landscape' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const headerFontSize = 16;
    const bodyFontSize = 9;
    const teacherColMinWidth = 180;

    const matrix = buildJornadaMatrix(assignments, timeSlots);
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const slotCount = Math.max(1, matrix.slots.length);
    const slotColWidth = Math.max(70, (usableWidth - teacherColMinWidth) / slotCount);
    const teacherColWidth = usableWidth - slotColWidth * slotCount;
    const columnWidths = [teacherColWidth, ...Array(slotCount).fill(slotColWidth)];

    const drawRow = (cells, { header = false } = {}) => {
      let x = doc.page.margins.left;
      let y = doc.y;
      const lineHeightPadding = header ? 10 : 8;
      let rowHeight = lineHeightPadding;

      cells.forEach((cell, index) => {
        const width = columnWidths[index];
        const measured = doc.heightOfString(cell, {
          width: width - 8,
          align: index === 0 ? 'left' : 'center',
        });
        rowHeight = Math.max(rowHeight, measured + (header ? 12 : 10));
      });

      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage({ margin: 36, size: 'LETTER', layout: 'landscape' });
        x = doc.page.margins.left;
        y = doc.y;
      }

      x = doc.page.margins.left;
      cells.forEach((cell, index) => {
        const width = columnWidths[index];
        doc
          .rect(x, y, width, rowHeight)
          .fillAndStroke(header ? '#1d4ed8' : '#ffffff', header ? '#1d4ed8' : '#cbd5f5')
          .fillColor(header ? '#ffffff' : '#0f172a');
        doc.text(cell, x + 4, y + (header ? 4 : 6), {
          width: width - 8,
          align: index === 0 ? 'left' : 'center',
        });
        x += width;
      });

      doc.moveDown();
      doc.y = y + rowHeight;
      doc.fillColor('#0f172a');
    };

    doc.font('Helvetica-Bold').fontSize(headerFontSize).text(`Matriz de jornada ${metadata.jornadaName} (${metadata.jornadaId})`, {
      align: 'center',
    });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10).fillColor('#475569').text(`Generado: ${new Date().toLocaleString()}`, {
      align: 'center',
    });
    doc.moveDown(0.8);

    if (assignments.length === 0 || timeSlots.length === 0) {
      doc.font('Helvetica').fontSize(12).fillColor('#1f2937').text('No se encontraron asignaciones para la jornada seleccionada.', {
        align: 'center',
      });
      doc.end();
      return;
    }

    const headerCells = ['Docente', ...matrix.slots.map((slot) => `${slot.day}\n${slot.start}-${slot.end}`)];
    doc.font('Helvetica-Bold').fontSize(bodyFontSize);
    drawRow(headerCells, { header: true });

    doc.font('Helvetica').fontSize(bodyFontSize - 1);
    matrix.teachers.forEach(({ teacher, slots }) => {
      const teacherCell = `${teacher.name}\n(${teacher.id})`;
      const slotCells = matrix.slots.map((slot) => {
        const assignment = slots.get(slot.id);
        if (!assignment) return '—';
        return `${assignment.classroom.id}\n${assignment.subject.id}`;
      });
      drawRow([teacherCell, ...slotCells]);
    });

    doc.end();
  });
}

async function createJornadaMatrixExcel(assignments, timeSlots, metadata) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Asignaciones';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Matriz');
  const matrix = buildJornadaMatrix(assignments, timeSlots);

  const headerRow = ['Docente'];
  matrix.slots.forEach((slot) => {
    headerRow.push(`${slot.day} ${slot.start}-${slot.end}`);
  });
  sheet.addRow([`Jornada: ${metadata.jornadaName} (${metadata.jornadaId})`]);
  sheet.addRow([]);
  const header = sheet.addRow(headerRow);
  header.font = { bold: true };

  matrix.teachers.forEach(({ teacher, slots }) => {
    const row = [`${teacher.name} (${teacher.id})`];
    matrix.slots.forEach((slot) => {
      const assignment = slots.get(slot.id);
      if (!assignment) {
        row.push('');
      } else {
        row.push(`${assignment.classroom.id}/${assignment.subject.id}`);
      }
    });
    sheet.addRow(row);
  });

  sheet.getColumn(1).width = 32;
  for (let index = 0; index < matrix.slots.length; index += 1) {
    sheet.getColumn(index + 2).width = 18;
  }

  return workbook.xlsx.writeBuffer();
}

function sendBufferResponse(res, buffer, { filename, mimeType }) {
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buffer);
}

async function handleAssignmentsReport(req, res, format, scopes) {
  try {
    assertAccessToValue(scopes.jornadaCodes, req.query.jornadaId?.trim(), 'jornadas');
  } catch (error) {
    return res.status(error.status ?? 403).json({ message: error.message });
  }

  const { filters, assignments, references } = await fetchAssignmentsWithDetails(req.query, scopes.jornadaCodes);
  const filtersSummary = buildFiltersSummary(filters, references);
  const sanitize = (value) => {
    if (value === undefined || value === null) return undefined;
    const trimmed = String(value).trim();
    return trimmed === '' ? undefined : trimmed;
  };
  const filterInput = {
    period: sanitize(req.query.period),
    jornadaId: sanitize(req.query.jornadaId),
    teacherId: sanitize(req.query.teacherId),
    sectionId: sanitize(req.query.sectionId),
    semester: sanitize(req.query.semester),
  };

  const includeSemesters = !filterInput.semester;
  const includeSections = !filterInput.sectionId;

  const groupedAssignments = groupAssignments(assignments, {
    includeSemesters,
    includeSections,
  });

  if (format === 'pdf') {
    const buffer = await createPdf(assignments, { filtersSummary, filters: filterInput });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return sendBufferResponse(res, buffer, {
      mimeType: 'application/pdf',
      filename: `reporte-asignaciones-${timestamp}.pdf`,
    });
  }

  if (['excel', 'xlsx', 'xls'].includes(format)) {
    const buffer = await createExcel(assignments, { filtersSummary });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return sendBufferResponse(res, buffer, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `reporte-asignaciones-${timestamp}.xlsx`,
    });
  }

  return res.json({
    type: 'assignments',
    filters,
    filtersSummary,
    count: assignments.length,
    items: assignments,
    groups: groupedAssignments.map((jornadaGroup) => ({
      jornada: jornadaGroup.jornada,
      semesters: jornadaGroup.semesters.map((semesterGroup) => ({
        semester: semesterGroup.semester,
        sections: semesterGroup.sections.map((sectionGroup) => ({
          section: sectionGroup.section,
          assignments: sectionGroup.assignments.map((assignment) => ({
            id: assignment.id,
            period: assignment.period,
            subject: assignment.subject,
            teacher: assignment.teacher,
            classroom: assignment.classroom,
            timeSlot: assignment.timeSlot,
            section: assignment.section,
            semester: assignment.semester,
          })),
        })),
      })),
    })),
  });
}

async function handleCoursesReport(req, res, format, scopes) {
  const careerId = req.query.careerId?.trim();
  if (!careerId) {
    return res.status(400).json({ message: 'careerId is required' });
  }

  try {
    assertAccessToValue(scopes.careerCodes, careerId, 'carreras');
  } catch (error) {
    return res.status(error.status ?? 403).json({ message: error.message });
  }

  const [subjects, career] = await Promise.all([
    Subject.find({ careerCode: careerId }).sort({ semester: 1, name: 1 }).lean(),
    Career.findOne({ code: careerId }).lean(),
  ]);

  const metadata = {
    careerId,
    careerName: career?.name ?? careerId,
  };

  if (format === 'pdf') {
    const buffer = await createCoursesPdf(subjects, metadata);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return sendBufferResponse(res, buffer, {
      mimeType: 'application/pdf',
      filename: `reporte-cursos-${careerId}-${timestamp}.pdf`,
    });
  }

  if (['excel', 'xlsx', 'xls'].includes(format)) {
    const buffer = await createCoursesExcel(subjects, metadata);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return sendBufferResponse(res, buffer, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `reporte-cursos-${careerId}-${timestamp}.xlsx`,
    });
  }

  return res.json({
    type: 'courses',
    careerId,
    careerName: metadata.careerName,
    count: subjects.length,
    items: subjects,
  });
}

async function handleJornadaMatrixReport(req, res, format, scopes) {
  const jornadaId = req.query.jornadaId?.trim();
  if (!jornadaId) {
    return res.status(400).json({ message: 'jornadaId is required' });
  }

  try {
    assertAccessToValue(scopes.jornadaCodes, jornadaId, 'jornadas');
  } catch (error) {
    return res.status(error.status ?? 403).json({ message: error.message });
  }

  const jornada = await Jornada.findOne({ code: jornadaId }).lean();
  if (!jornada) {
    return res.status(404).json({ message: 'Jornada not found' });
  }

  const [timeSlots, detail] = await Promise.all([
    TimeSlot.find({ jornadaCode: jornadaId }).lean(),
    fetchAssignmentsWithDetails({ jornadaId }, [jornadaId]),
  ]);

  if (format === 'pdf') {
    const buffer = await createJornadaMatrixPdf(detail.assignments, timeSlots, {
      jornadaId,
      jornadaName: jornada.name ?? jornadaId,
    });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return sendBufferResponse(res, buffer, {
      mimeType: 'application/pdf',
      filename: `matriz-jornada-${jornadaId}-${timestamp}.pdf`,
    });
  }

  if (['excel', 'xlsx', 'xls'].includes(format)) {
    const buffer = await createJornadaMatrixExcel(detail.assignments, timeSlots, {
      jornadaId,
      jornadaName: jornada.name ?? jornadaId,
    });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return sendBufferResponse(res, buffer, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `matriz-jornada-${jornadaId}-${timestamp}.xlsx`,
    });
  }

  const matrix = buildJornadaMatrix(detail.assignments, timeSlots);
  return res.json({
    type: 'jornadaMatrix',
    jornadaId,
    jornadaName: jornada.name ?? jornadaId,
    slots: matrix.slots,
    teachers: matrix.teachers.map(({ teacher, slots }) => ({
      teacher,
      slots: Object.fromEntries(
        Array.from(slots.entries()).map(([slotId, assignment]) => [
          slotId,
          assignment ? `${assignment.classroom.id}/${assignment.subject.id}` : '',
        ]),
      ),
    })),
  });
}

export async function getReports(req, res) {
  const type = String(req.query.type ?? 'assignments');
  const format = String(req.query.format ?? 'json').toLowerCase();
  const scopes = await resolveCoordinatorScopes(req.user);

  if (type === 'courses') {
    return handleCoursesReport(req, res, format, scopes);
  }

  if (type === 'jornadaMatrix') {
    return handleJornadaMatrixReport(req, res, format, scopes);
  }

  return handleAssignmentsReport(req, res, format, scopes);
}
