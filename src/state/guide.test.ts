import { beforeEach, describe, expect, it } from 'vitest';
import {
  markAdvanced,
  markPlayed,
  markShelved,
  markViewed,
  readGuideStep,
  replayGuide,
  skipGuide,
} from './guide';
import { getState, setState } from './store';

const initial = getState();

beforeEach(() => {
  setState({ ...initial, entered: true, mode: 'CATALOG' });
  replayGuide();
});

describe('readGuideStep', () => {
  it('says nothing before the visitor enters the room', () => {
    setState({ entered: false });
    expect(readGuideStep()).toBeNull();
  });

  it('walks play → shelf → view, then goes quiet', () => {
    expect(readGuideStep()).toBe('play');
    markPlayed();
    expect(readGuideStep()).toBe('shelf');
    markShelved();
    expect(readGuideStep()).toBe('view');
    markViewed();
    expect(readGuideStep()).toBeNull();
  });

  it('points at the skip key while a tape with more memories plays', () => {
    const tape = initial.collections[0];
    setState({ mode: 'PLAYING', insertedId: tape.id, slideIndex: 0 });
    expect(readGuideStep()).toBe('next');
    markAdvanced();
    expect(readGuideStep()).toBeNull();
  });

  it('stays out of the way of dialogs and the free view', () => {
    setState({ createOpen: true });
    expect(readGuideStep()).toBeNull();
    setState({ createOpen: false, orbitInspect: true });
    expect(readGuideStep()).toBeNull();
  });

  it('sends an empty crate to the shelf', () => {
    setState({ collectionIds: [] });
    expect(readGuideStep()).toBe('empty-crate');
  });

  it('stops for good when skipped, and Help can bring it back', () => {
    skipGuide();
    expect(readGuideStep()).toBeNull();
    replayGuide();
    expect(readGuideStep()).toBe('play');
  });
});
