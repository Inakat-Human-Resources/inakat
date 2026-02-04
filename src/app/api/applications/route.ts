// RUTA: src/app/api/applications/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Listar aplicaciones (filtradas por job o por usuario admin)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const status = searchParams.get('status');
    const candidateEmail = searchParams.get('candidateEmail');

    const where: any = {};

    if (jobId) {
      where.jobId = parseInt(jobId);
    }

    if (status) {
      where.status = status;
    }

    if (candidateEmail) {
      where.candidateEmail = candidateEmail;
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
            salary: true
          }
        },
        user: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      data: applications,
      count: applications.length
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch applications' },
      { status: 500 }
    );
  }
}

// POST - Crear nueva aplicación
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      jobId,
      userId,
      candidateName,
      candidateEmail,
      candidatePhone,
      cvUrl,
      coverLetter
    } = body;

    // Validaciones básicas
    if (!jobId || !candidateName || !candidateEmail) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Faltan campos requeridos: jobId, candidateName, candidateEmail'
        },
        { status: 400 }
      );
    }

    // Verificar que la vacante existe
    const job = await prisma.job.findUnique({
      where: { id: parseInt(jobId) }
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Vacante no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que la vacante esté activa
    if (job.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Esta vacante ya no está activa' },
        { status: 400 }
      );
    }

    // Verificar si ya aplicó antes
    const existingApplication = await prisma.application.findFirst({
      where: {
        jobId: parseInt(jobId),
        candidateEmail: candidateEmail.toLowerCase()
      }
    });

    if (existingApplication) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ya has aplicado a esta vacante anteriormente'
        },
        { status: 400 }
      );
    }

    // Crear aplicación
    const application = await prisma.application.create({
      data: {
        jobId: parseInt(jobId),
        userId: userId || null,
        candidateName,
        candidateEmail: candidateEmail.toLowerCase(),
        candidatePhone: candidatePhone || null,
        cvUrl: cvUrl || null,
        coverLetter: coverLetter || null,
        status: 'pending'
      },
      include: {
        job: {
          select: {
            title: true,
            company: true
          }
        }
      }
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Aplicación enviada exitosamente',
        data: application
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating application:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create application' },
      { status: 500 }
    );
  }
}
