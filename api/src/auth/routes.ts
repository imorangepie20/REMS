import { Router } from 'express';
import { signupSchema } from '@rems/shared';
import { prisma } from '../db';
import { hashPassword } from './password';
import { createSession } from './session';
import { config } from '../config';
import { ConflictError } from '../errors';

export const authRouter = Router();

authRouter.post('/signup', async (req, res) => {
  const data = signupSchema.parse(req.body);

  const exists = await prisma.agent.findUnique({ where: { email: data.owner.email } });
  if (exists) throw new ConflictError('이미 사용 중인 이메일입니다');

  const passwordHash = await hashPassword(data.owner.password);

  const result = await prisma.$transaction(async (tx) => {
    const agency = await tx.agency.create({ data: data.agency });
    const agent = await tx.agent.create({
      data: {
        agencyId: agency.id,
        email: data.owner.email,
        passwordHash,
        name: data.owner.name,
        phone: data.owner.phone,
        role: 'owner',
      },
    });
    return { agency, agent };
  });

  const token = await createSession(result.agent.id);
  res.cookie(config.session.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // 개발용 — 프로덕션에선 HTTPS + true
    maxAge: config.session.ttlMs,
    path: '/',
  });

  res.status(201).json({
    agent: {
      id: result.agent.id,
      email: result.agent.email,
      name: result.agent.name,
      role: result.agent.role,
      agencyId: result.agent.agencyId,
    },
    agency: {
      id: result.agency.id,
      name: result.agency.name,
    },
  });
});
