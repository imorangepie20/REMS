import { Router } from 'express';
import { signupSchema, loginSchema } from '@rems/shared';
import { prisma } from '../db';
import { hashPassword, verifyPassword } from './password';
import { createSession, destroySession } from './session';
import { requireAuth } from './middleware';
import { config } from '../config';
import { ConflictError, UnauthorizedError } from '../errors';

export const authRouter = Router();

/** signup·login 공통 세션 쿠키 옵션 */
const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.session.secure,
  maxAge: config.session.ttlMs,
  path: '/',
};

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
  res.cookie(config.session.cookieName, token, sessionCookieOptions);

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

authRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const agent = await prisma.agent.findUnique({ where: { email } });
  if (!agent) throw new UnauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다');

  const ok = await verifyPassword(password, agent.passwordHash);
  if (!ok) throw new UnauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다');

  const agency = await prisma.agency.findUnique({ where: { id: agent.agencyId } });
  if (!agency) throw new UnauthorizedError();

  const token = await createSession(agent.id);
  res.cookie(config.session.cookieName, token, sessionCookieOptions);

  res.json({
    agent: {
      id: agent.id,
      email: agent.email,
      name: agent.name,
      role: agent.role,
      agencyId: agent.agencyId,
    },
    agency: { id: agency.id, name: agency.name },
  });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const agentId = req.agent!.id;
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new UnauthorizedError();
  const agency = await prisma.agency.findUnique({ where: { id: agent.agencyId } });
  if (!agency) throw new UnauthorizedError();
  res.json({
    agent: {
      id: agent.id,
      email: agent.email,
      name: agent.name,
      role: agent.role,
      agencyId: agent.agencyId,
    },
    agency: { id: agency.id, name: agency.name },
  });
});

authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.[config.session.cookieName];
  if (token) await destroySession(token);
  res.clearCookie(config.session.cookieName, { path: '/' });
  res.status(204).send();
});
