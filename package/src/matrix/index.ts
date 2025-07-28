import { Effect } from 'effect';

// ========================
// LESSON 1: Basic Effect Types
// ========================

// Effect.Effect<A, E, R> has three type parameters:
// A = Success type (what the effect produces)
// E = Error type (what errors it can fail with)
// R = Requirements (what services/context it needs)
