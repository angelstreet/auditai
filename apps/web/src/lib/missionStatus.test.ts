import { describe, expect, it } from 'vitest';
import { missionHref, missionStatus, nextStep } from './missionStatus';

/** TASK-AD2: four status words and exactly one next step per mission. */
describe('missionStatus', () => {
  it('maps the engagement status, a published report wins', () => {
    expect(missionStatus({ status: 'draft', reportPublished: false })).toBe('draft');
    expect(missionStatus({ status: 'scheduled', reportPublished: false })).toBe('draft');
    expect(missionStatus({ status: 'in_field', reportPublished: false })).toBe('open');
    expect(missionStatus({ status: 'review', reportPublished: false })).toBe('closed');
    expect(missionStatus({ status: 'closed', reportPublished: true })).toBe('published');
  });
});

describe('nextStep', () => {
  const base = { reportPublished: false, links: 0, submitted: 0 } as const;
  it('draft: create links, from Settings where the mission is launched', () => {
    expect(nextStep({ ...base, status: 'draft' })).toEqual({
      step: 'createLinks',
      tab: 'settings',
    });
  });
  it('open without links: create links', () => {
    expect(nextStep({ ...base, status: 'in_field' })).toEqual({
      step: 'createLinks',
      tab: 'invitations',
    });
  });
  it('open under five answers: follow answers; from five: read the brief', () => {
    expect(nextStep({ ...base, status: 'in_field', links: 12, submitted: 4 })).toEqual({
      step: 'followAnswers',
      tab: 'invitations',
    });
    expect(nextStep({ ...base, status: 'in_field', links: 12, submitted: 5 })).toEqual({
      step: 'readBrief',
      tab: 'overview',
    });
  });
  it('closed or published: write the report', () => {
    expect(nextStep({ ...base, status: 'closed', links: 12, submitted: 9 }).step).toBe(
      'writeReport',
    );
    expect(nextStep({ ...base, status: 'closed', reportPublished: true }).tab).toBe('report');
  });
});

describe('missionHref', () => {
  it('keeps the organisation and puts Overview at the mission root', () => {
    expect(missionHref('e1', 'overview', 't1')).toBe('/admin/engagements/e1?tenant=t1');
    expect(missionHref('e1', 'answers', 't1')).toBe('/admin/engagements/e1/answers?tenant=t1');
  });
});
