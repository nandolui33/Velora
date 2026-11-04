import type { BusinessSector } from "@prisma/client";

export type TemplateService = {
  name: string;
  category: string;
  durationMinutes: number;
  priceCents: number;
  description?: string;
  requiredResourceKey?: string;
};

export type TemplateResourceType = {
  key: string;
  name: string;
  description?: string;
  resourceName: string;
};

export type SectorTemplate = {
  key: BusinessSector;
  label: string;
  version: string;
  description: string;
  services: TemplateService[];
  resourceTypes: TemplateResourceType[];
};

export const TEMPLATE_VERSION = "2026.1";

const barberia: SectorTemplate = {
  key: "barberia",
  label: "Barbería",
  version: TEMPLATE_VERSION,
  description: "Cortes, barba, afeitado y cuidado masculino.",
  resourceTypes: [
    {
      key: "sillon-barbero",
      name: "Sillón de barbero",
      resourceName: "Sillón 1",
      description: "Sillón con lavacabezas o punto de trabajo.",
    },
  ],
  services: [
    {
      name: "Corte de pelo",
      category: "Cortes",
      durationMinutes: 30,
      priceCents: 1800,
      requiredResourceKey: "sillon-barbero",
    },
    {
      name: "Corte + barba",
      category: "Cortes",
      durationMinutes: 45,
      priceCents: 2600,
      requiredResourceKey: "sillon-barbero",
    },
    {
      name: "Arreglo de barba",
      category: "Barba",
      durationMinutes: 20,
      priceCents: 1200,
      requiredResourceKey: "sillon-barbero",
    },
    {
      name: "Afeitado clásico",
      category: "Barba",
      durationMinutes: 30,
      priceCents: 1500,
    },
    {
      name: "Corte infantil",
      category: "Cortes",
      durationMinutes: 25,
      priceCents: 1400,
    },
  ],
};

const peluqueria: SectorTemplate = {
  key: "peluqueria",
  label: "Peluquería",
  version: TEMPLATE_VERSION,
  description: "Corte, color, tratamientos y peinados.",
  resourceTypes: [
    {
      key: "sillon-peluqueria",
      name: "Sillón de peluquería",
      resourceName: "Sillón 1",
    },
    {
      key: "lavacabezas",
      name: "Lavacabezas",
      resourceName: "Lavacabezas 1",
    },
  ],
  services: [
    {
      name: "Corte y peinado",
      category: "Cortes",
      durationMinutes: 45,
      priceCents: 2500,
      requiredResourceKey: "sillon-peluqueria",
    },
    {
      name: "Corte hombre",
      category: "Cortes",
      durationMinutes: 30,
      priceCents: 1800,
      requiredResourceKey: "sillon-peluqueria",
    },
    {
      name: "Color raíz",
      category: "Color",
      durationMinutes: 75,
      priceCents: 4500,
      requiredResourceKey: "lavacabezas",
    },
    {
      name: "Mechas",
      category: "Color",
      durationMinutes: 120,
      priceCents: 7500,
      requiredResourceKey: "lavacabezas",
    },
    {
      name: "Tratamiento hidratante",
      category: "Tratamientos",
      durationMinutes: 30,
      priceCents: 2000,
      requiredResourceKey: "lavacabezas",
    },
  ],
};

const manicura: SectorTemplate = {
  key: "manicura",
  label: "Manicura y pedicura",
  version: TEMPLATE_VERSION,
  description: "Manicura, pedicura, gel y semipermanente.",
  resourceTypes: [
    {
      key: "mesa-manicura",
      name: "Mesa de manicura",
      resourceName: "Mesa 1",
    },
  ],
  services: [
    {
      name: "Manicura básica",
      category: "Manicura",
      durationMinutes: 30,
      priceCents: 1500,
      requiredResourceKey: "mesa-manicura",
    },
    {
      name: "Semipermanente",
      category: "Manicura",
      durationMinutes: 45,
      priceCents: 2500,
      requiredResourceKey: "mesa-manicura",
    },
    {
      name: "Uñas de gel",
      category: "Manicura",
      durationMinutes: 75,
      priceCents: 4000,
      requiredResourceKey: "mesa-manicura",
    },
    {
      name: "Pedicura completa",
      category: "Pedicura",
      durationMinutes: 60,
      priceCents: 3500,
    },
    {
      name: "Retirada de esmalte",
      category: "Manicura",
      durationMinutes: 15,
      priceCents: 800,
    },
  ],
};

const spa: SectorTemplate = {
  key: "spa",
  label: "Spa",
  version: TEMPLATE_VERSION,
  description: "Masajes, rituales y tratamientos de bienestar.",
  resourceTypes: [
    {
      key: "camilla-spa",
      name: "Camilla de spa",
      resourceName: "Camilla 1",
    },
    {
      key: "sala-relax",
      name: "Sala de relax",
      resourceName: "Sala 1",
    },
  ],
  services: [
    {
      name: "Masaje relajante 60'",
      category: "Masajes",
      durationMinutes: 60,
      priceCents: 5500,
      requiredResourceKey: "camilla-spa",
    },
    {
      name: "Masaje descontracturante 60'",
      category: "Masajes",
      durationMinutes: 60,
      priceCents: 6500,
      requiredResourceKey: "camilla-spa",
    },
    {
      name: "Ritual spa 90'",
      category: "Rituales",
      durationMinutes: 90,
      priceCents: 8500,
      requiredResourceKey: "camilla-spa",
    },
    {
      name: "Circuito de aguas",
      category: "Rituales",
      durationMinutes: 60,
      priceCents: 3500,
      requiredResourceKey: "sala-relax",
    },
    {
      name: "Masaje en pareja",
      category: "Masajes",
      durationMinutes: 60,
      priceCents: 10000,
      requiredResourceKey: "sala-relax",
    },
  ],
};

const cejasPestanas: SectorTemplate = {
  key: "cejas_pestanas",
  label: "Cejas y pestañas",
  version: TEMPLATE_VERSION,
  description: "Diseño de cejas, laminado y extensiones.",
  resourceTypes: [
    {
      key: "camilla-cejas",
      name: "Camilla de cejas",
      resourceName: "Camilla 1",
    },
  ],
  services: [
    {
      name: "Diseño de cejas",
      category: "Cejas",
      durationMinutes: 30,
      priceCents: 1500,
      requiredResourceKey: "camilla-cejas",
    },
    {
      name: "Laminado de cejas",
      category: "Cejas",
      durationMinutes: 60,
      priceCents: 3500,
      requiredResourceKey: "camilla-cejas",
    },
    {
      name: "Extensiones de pestañas",
      category: "Pestañas",
      durationMinutes: 120,
      priceCents: 6500,
      requiredResourceKey: "camilla-cejas",
    },
    {
      name: "Lifting de pestañas",
      category: "Pestañas",
      durationMinutes: 60,
      priceCents: 3500,
      requiredResourceKey: "camilla-cejas",
    },
    {
      name: "Retoque de pestañas",
      category: "Pestañas",
      durationMinutes: 45,
      priceCents: 3000,
      requiredResourceKey: "camilla-cejas",
    },
  ],
};

const estetica: SectorTemplate = {
  key: "estetica",
  label: "Estética",
  version: TEMPLATE_VERSION,
  description: "Faciales, depilación y tratamientos corporales.",
  resourceTypes: [
    {
      key: "camilla-estetica",
      name: "Camilla de estética",
      resourceName: "Camilla 1",
    },
  ],
  services: [
    {
      name: "Limpieza facial",
      category: "Facial",
      durationMinutes: 60,
      priceCents: 4500,
      requiredResourceKey: "camilla-estetica",
    },
    {
      name: "Hidratación facial",
      category: "Facial",
      durationMinutes: 45,
      priceCents: 3500,
      requiredResourceKey: "camilla-estetica",
    },
    {
      name: "Depilación piernas completas",
      category: "Depilación",
      durationMinutes: 45,
      priceCents: 3000,
    },
    {
      name: "Depilación axilas",
      category: "Depilación",
      durationMinutes: 15,
      priceCents: 1200,
    },
    {
      name: "Masaje corporal 45'",
      category: "Corporal",
      durationMinutes: 45,
      priceCents: 4000,
      requiredResourceKey: "camilla-estetica",
    },
  ],
};

const masajes: SectorTemplate = {
  key: "masajes",
  label: "Masajes",
  version: TEMPLATE_VERSION,
  description: "Masajes terapéuticos, relajantes y deportivos.",
  resourceTypes: [
    {
      key: "camilla-masaje",
      name: "Camilla de masaje",
      resourceName: "Camilla 1",
    },
  ],
  services: [
    {
      name: "Masaje relajante 50'",
      category: "Masajes",
      durationMinutes: 50,
      priceCents: 4500,
      requiredResourceKey: "camilla-masaje",
    },
    {
      name: "Masaje descontracturante 50'",
      category: "Masajes",
      durationMinutes: 50,
      priceCents: 5000,
      requiredResourceKey: "camilla-masaje",
    },
    {
      name: "Masaje deportivo 60'",
      category: "Masajes",
      durationMinutes: 60,
      priceCents: 6000,
      requiredResourceKey: "camilla-masaje",
    },
    {
      name: "Masaje prenatal",
      category: "Masajes",
      durationMinutes: 50,
      priceCents: 5000,
      requiredResourceKey: "camilla-masaje",
    },
    {
      name: "Drenaje linfático",
      category: "Terapias",
      durationMinutes: 60,
      priceCents: 5500,
      requiredResourceKey: "camilla-masaje",
    },
  ],
};

export const sectorTemplates: SectorTemplate[] = [
  barberia,
  peluqueria,
  manicura,
  spa,
  cejasPestanas,
  estetica,
  masajes,
];

export function getSectorTemplate(key: string) {
  return sectorTemplates.find((template) => template.key === key) ?? null;
}
