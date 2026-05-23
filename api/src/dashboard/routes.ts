import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/summary', async (req, res) => {
  const agent = req.agent!;
  const agencyId = agent.agencyId;

  const listingGroups = await prisma.listing.groupBy({
    by: ['status'],
    where: { agencyId },
    _count: { _all: true },
  });
  const listings = { active: 0, completed: 0, hidden: 0 };
  for (const g of listingGroups) {
    listings[g.status] = g._count._all;
  }

  const [mineCount, agencyCount] = await Promise.all([
    prisma.customer.count({ where: { agencyId, ownerAgentId: agent.id } }),
    prisma.customer.count({ where: { agencyId } }),
  ]);

  const customerWhere = agent.role === 'member'
    ? { agencyId, ownerAgentId: agent.id }
    : { agencyId };
  const myCustomerIds = (
    await prisma.customer.findMany({ where: customerWhere, select: { id: true } })
  ).map((c) => c.id);

  const matchGroups = myCustomerIds.length === 0
    ? []
    : await prisma.customerListing.groupBy({
        by: ['status'],
        where: { customerId: { in: myCustomerIds } },
        _count: { _all: true },
      });
  const byStatus = { suggested: 0, interested: 0, visited: 0, contracted: 0, rejected: 0 };
  for (const g of matchGroups) {
    byStatus[g.status] = g._count._all;
  }

  const recentRows = myCustomerIds.length === 0
    ? []
    : await prisma.customerListing.findMany({
        where: { customerId: { in: myCustomerIds } },
        include: {
          customer: { select: { name: true } },
          listing: { select: { title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

  res.json({
    listings,
    customers: { mine: mineCount, agency: agencyCount },
    matches: {
      byStatus,
      recent: recentRows.map((m) => ({
        id: m.id,
        customerName: m.customer.name,
        listingTitle: m.listing.title,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      })),
    },
  });
});
