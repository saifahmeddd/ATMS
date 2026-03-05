import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@almnfthen.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@almnfthen.com",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@almnfthen.com" },
    update: {},
    create: {
      name: "Manager User",
      email: "manager@almnfthen.com",
      passwordHash: await bcrypt.hash("Manager123!", 12),
      role: "MANAGER",
      status: "ACTIVE",
    },
  });

  const employee1 = await prisma.user.upsert({
    where: { email: "employee1@almnfthen.com" },
    update: {},
    create: {
      name: "Employee One",
      email: "employee1@almnfthen.com",
      passwordHash: await bcrypt.hash("Employee123!", 12),
      role: "EMPLOYEE",
      status: "ACTIVE",
      managerId: manager.id,
    },
  });

  const employee2 = await prisma.user.upsert({
    where: { email: "employee2@almnfthen.com" },
    update: {},
    create: {
      name: "Employee Two",
      email: "employee2@almnfthen.com",
      passwordHash: await bcrypt.hash("Employee123!", 12),
      role: "EMPLOYEE",
      status: "ACTIVE",
      managerId: manager.id,
    },
  });

  const course = await prisma.course.upsert({
    where: { id: "seed-course-1" },
    update: {},
    create: {
      id: "seed-course-1",
      title: "Introduction to Web Development",
      description: "Learn the fundamentals of web development.",
      status: "PUBLISHED",
      category: "Web Development",
      createdById: admin.id,
    },
  });

  const module1 = await prisma.module.upsert({
    where: { id: "seed-module-1" },
    update: {},
    create: {
      id: "seed-module-1",
      courseId: course.id,
      title: "HTML Basics",
      type: "VIDEO",
      contentUrl: "https://www.youtube.com/watch?v=example",
      sequence: 1,
    },
  });

  const quiz = await prisma.quiz.upsert({
    where: { moduleId: module1.id },
    update: {},
    create: {
      moduleId: module1.id,
      passingScore: 70,
      durationMinutes: 10,
      maxAttempts: 3,
    },
  });

  const existingQuestions = await prisma.question.count({
    where: { quizId: quiz.id },
  });
  if (existingQuestions === 0) {
    await prisma.question.createMany({
      data: [
        {
          quizId: quiz.id,
          questionText: "What does HTML stand for?",
          options: ["Hyper Text Markup Language", "High Tech Markup Language", "Home Tool Markup Language", "Hyperlink Text Markup Language"],
          correctAnswer: "Hyper Text Markup Language",
        },
        {
          quizId: quiz.id,
          questionText: "Which tag is used for the largest heading?",
          options: ["<h6>", "<h1>", "<heading>", "<head>"],
          correctAnswer: "<h1>",
        },
      ],
    });
  }

  const enrollment = await prisma.enrollment.upsert({
    where: {
      userId_courseId: { userId: employee1.id, courseId: course.id },
    },
    update: {},
    create: {
      userId: employee1.id,
      courseId: course.id,
      status: "APPROVED",
      approvedById: manager.id,
      progressPct: 0,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("Seed completed successfully:");
  console.log("- Admin:", admin.email);
  console.log("- Manager:", manager.email);
  console.log("- Employees:", employee1.email, employee2.email);
  console.log("- Course:", course.title);
  console.log("- Enrollment:", enrollment.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
