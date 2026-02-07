import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ChangeRequestStatus } from "@prisma/client";

interface RouteParams {
  params: { id: string };
}

// Valid status transitions for the approval workflow
const VALID_TRANSITIONS: Record<string, ChangeRequestStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "CANCELLED"],
  REJECTED: ["DRAFT"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: ["DRAFT"],
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const changeRequest = await prisma.changeRequest.findUnique({
      where: { id },
      include: {
        client: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            jobTitle: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            jobTitle: true,
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!changeRequest) {
      return NextResponse.json(
        { error: "Change request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(changeRequest);
  } catch (error) {
    console.error("Error fetching change request:", error);
    return NextResponse.json(
      { error: "Failed to fetch change request" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const body = await request.json();

    const existingCR = await prisma.changeRequest.findUnique({
      where: { id },
    });

    if (!existingCR) {
      return NextResponse.json(
        { error: "Change request not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    // Handle status transition with workflow validation
    if (body.status && body.status !== existingCR.status) {
      const allowedTransitions = VALID_TRANSITIONS[existingCR.status] || [];
      if (!allowedTransitions.includes(body.status as ChangeRequestStatus)) {
        return NextResponse.json(
          {
            error: `Invalid status transition from ${existingCR.status} to ${body.status}. Allowed transitions: ${allowedTransitions.join(", ") || "none"}`,
          },
          { status: 400 }
        );
      }

      // Only ADMIN and MANAGER can approve/reject
      if (
        (body.status === "APPROVED" || body.status === "REJECTED") &&
        userRole !== "ADMIN" &&
        userRole !== "MANAGER"
      ) {
        return NextResponse.json(
          { error: "Only administrators and managers can approve or reject change requests" },
          { status: 403 }
        );
      }

      updateData.status = body.status;

      // Handle approval
      if (body.status === "APPROVED") {
        updateData.approverId = userId;
        updateData.approvedAt = new Date();
        if (body.approvalNotes) {
          updateData.approvalNotes = body.approvalNotes;
        }
      }

      // Handle rejection
      if (body.status === "REJECTED") {
        updateData.approverId = userId;
        if (body.approvalNotes) {
          updateData.approvalNotes = body.approvalNotes;
        }
      }

      // Handle start of implementation
      if (body.status === "IN_PROGRESS") {
        updateData.actualStart = new Date();
      }

      // Handle completion
      if (body.status === "COMPLETED") {
        updateData.actualEnd = new Date();
      }

      // Create a comment documenting the status change
      await prisma.changeRequestComment.create({
        data: {
          changeRequestId: id,
          authorId: userId,
          content: `Status changed from ${existingCR.status} to ${body.status}${body.approvalNotes ? `: ${body.approvalNotes}` : ""}`,
        },
      });
    }

    // Handle other field updates (only allowed if not in a terminal state)
    const terminalStatuses: ChangeRequestStatus[] = ["COMPLETED", "CANCELLED"];
    if (!terminalStatuses.includes(existingCR.status as ChangeRequestStatus) || body.status) {
      const editableFields = [
        "title",
        "description",
        "reason",
        "type",
        "priority",
        "risk",
        "implementationPlan",
        "rollbackPlan",
        "testingPlan",
      ] as const;

      for (const field of editableFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      // Handle date fields
      const dateFields = ["scheduledStart", "scheduledEnd"] as const;
      for (const field of dateFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field] ? new Date(body[field]) : null;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const changeRequest = await prisma.changeRequest.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(changeRequest);
  } catch (error) {
    console.error("Error updating change request:", error);
    return NextResponse.json(
      { error: "Failed to update change request" },
      { status: 500 }
    );
  }
}
