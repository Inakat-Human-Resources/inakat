// RUTA: src/app/diseno/fixtures/index.ts
//
// Todas las respuestas simuladas del banco de pruebas, en orden de prioridad:
// primero los bloques (cada agente llena el suyo), al final las base. Gana la
// primera que coincide.

import type { Fixture } from './tipos';
import { FIXTURES_BASE } from './base';
import { fixtures as b1 } from './b1-admin-core';
import { fixtures as b2 } from './b2-admin-candidatos';
import { fixtures as b3 } from './b3-admin-operacion';
import { fixtures as b4 } from './b4-admin-catalogo';
import { fixtures as b5 } from './b5-empresa';
import { fixtures as b6 } from './b6-vacante';
import { fixtures as b7 } from './b7-candidato';
import { fixtures as b8 } from './b8-staff';
import { fixtures as b9 } from './b9-modal-perfil';

export type { Fixture, ContextoFixture } from './tipos';

export const FIXTURES: Fixture[] = [...b1, ...b2, ...b3, ...b4, ...b5, ...b6, ...b7, ...b8, ...b9, ...FIXTURES_BASE];
