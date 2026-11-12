import { webText } from "../content";
export const COMPANY_INFO = {
  get name() {
    return webText("company.7dcbb3737f2d", "AUTOS QP S.A.S.");
  },
  get brandName() {
    return webText("company.065000a20af8", "Autos QP");
  },
  get nit() {
    return webText("company.7d3ed5335323", "901.263.615-6");
  },
  get slogan() {
    return webText("company.6f70f683592b", "Abriendo caminos contigo");
  },
  get secondarySlogan() {
    return webText("company.36b316943c37", "M\xC1S QUE AUTOS, CREAMOS CONEXIONES");
  },
  get subtitle() {
    return webText("company.d8b22e8cf6f0", "Encuentra el auto que se adapta a tu vida. Calidad, confianza y el mejor servicio.");
  },
  get address() {
    return webText("company.9908cf3ed647", "C.C. Outlet Factory, Av. de las Am\xE9ricas #62-84, Local 128, Puente Aranda, Bogot\xE1");
  },
  get shortAddress() {
    return webText("company.11929a5d8819", "C.C. Outlet Factory, Local 128, Bogot\xE1");
  },
  get phone1() {
    return webText("company.a617b74e68a6", "321 891 2903");
  },
  get phone1Raw() {
    return webText("company.462a906adeb4", "573218912903");
  },
  get phone2() {
    return webText("company.278c9d0e9a73", "300 252 3226");
  },
  get phone2Raw() {
    return webText("company.06f6a2dcfd76", "573002523226");
  },
  get email() {
    return webText("company.60c4cd5e891a", "autosqpc@gmail.com");
  },
  get scheduleWeekday() {
    return webText("company.080f7b7e1f32", "Lunes a s\xE1bado 9:00 a.m. \u2013 6:00 p.m.");
  },
  get scheduleWeekend() {
    return webText("company.bd8694dd1194", "Domingos y festivos 10:00 a.m. \u2013 3:00 p.m.");
  },
  social: {
    get facebook() {
      return webText("company.c1e252662528", "https://www.facebook.com/share/19fMWb1pLP/?mibextid=wwXIfr");
    },
    get instagram() {
      return webText("company.a27546ad9a78", "https://www.instagram.com/autosqp?vrfl=ZGtucHlndDI4bjM2&utm_source=qr");
    },
    get instagramHandle() {
      return webText("company.2a3bce221520", "@autosqp");
    },
    get tiktok() {
      return webText("company.639cced2c440", "https://www.tiktok.com/@autosqp?_r=1&_t=ZS-9BKQB0VbcOb");
    },
    get tiktokHandle() {
      return webText("company.2a3bce221520.2", "@autosqp");
    },
    get tiktokAdvisor() {
      return webText("company.74f4c653570a", "https://www.tiktok.com/@jenn_quimba?_r=1&_t=ZS-9BKPyEk75AV");
    },
    get tiktokAdvisorHandle() {
      return webText("company.7b93c12920ef", "@jenn_quimba");
    },
    get whatsapp() {
      return webText("company.d6f6a75e96c5", "https://wa.me/573218912903");
    }
  },
  stats: {
    availableCars: '+120',
    satisfiedClients: '+850',
    yearsExperience: '+5 Años',
    transparency: '100%'
  },
  banks: [{
    get name() {
      return webText("company.fb8792abe52f", "Banco Santander");
    },
    category: 'Banco Comercial'
  }, {
    get name() {
      return webText("company.5cc572ed25b7", "Banco de Occidente");
    },
    category: 'Líder en Crédito Vehicular'
  }, {
    get name() {
      return webText("company.67e7543af0d4", "Finandina");
    },
    category: 'Especialista Automotriz'
  }, {
    get name() {
      return webText("company.2e27ef674086", "Banco W");
    },
    category: 'Inclusión Financiera'
  }, {
    get name() {
      return webText("company.cee4c10f9407", "Bancam\xEDa");
    },
    category: 'Microfinanzas y Emprendedores'
  }, {
    get name() {
      return webText("company.07b3d10a3ea1", "Cooperativas de Cr\xE9dito");
    },
    category: 'Tasas Preferenciales'
  }],
  insurers: [{
    get name() {
      return webText("company.88aa11fee61d", "La Equidad Seguros");
    },
    type: 'Todo Riesgo & SOAT'
  }, {
    get name() {
      return webText("company.18ad8d270637", "Mapfre");
    },
    type: 'Asistencia y Cobertura Total'
  }, {
    get name() {
      return webText("company.de4630303d1d", "Qualitas");
    },
    type: 'Especialista en Autos'
  }, {
    get name() {
      return webText("company.684f0ec52018", "HDI Seguros");
    },
    type: 'Coberturas Premium'
  }, {
    get name() {
      return webText("company.95f295b58cf5", "Zurich");
    },
    type: 'Protección Global'
  }, {
    get name() {
      return webText("company.9f19a586e9a9", "Sura Seguros");
    },
    type: 'Seguro Integral'
  }],
  get warrantyNotice() {
    return webText("company.7345acbdfa4c", "Servicio opcional con costo, otorgado por un aliado (no por Autos QP). Solo caja y motor. Pregunta a tu asesor.");
  },
  get warrantyLegalFull() {
    return webText("company.c4413558ee43", "Servicio opcional, no incluido en el precio del veh\xEDculo. El cliente debe solicitarlo y tiene un costo adicional que paga el cliente. La garant\xEDa de caja y motor es otorgada por una empresa aliada (un tercero), no por Autos QP S.A.S., que act\xFAa solo como intermediario. Aplica \xFAnicamente a veh\xEDculos de modelo menor a 10 a\xF1os y cubre solo caja y motor. Cobertura, vigencia, exclusiones y valor dependen del proveedor y se entregan por escrito antes de contratar.");
  }
};
