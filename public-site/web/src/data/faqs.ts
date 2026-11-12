import { webText } from "../content";
import { FAQItem } from '../types';
export const FAQ_LIST: FAQItem[] = [
// SOBRE COMPRA DE VEHÍCULOS
{
  id: 'compra-1',
  category: 'COMPRA',
  get categoryLabel() {
    return webText("faqs.a5cf621aa5c5", "Compra de Veh\xEDculos");
  },
  get question() {
    return webText("faqs.4e893f4629ab", "\xBFLos veh\xEDculos son 100% asegurables?");
  },
  get answer() {
    return webText("faqs.b43825c13f2a", "S\xED. Todos nuestros veh\xEDculos pasan por un riguroso proceso de verificaci\xF3n jur\xEDdica y mec\xE1nica, y son asegurables en cualquier compa\xF1\xEDa de seguros del mercado nacional.");
  }
}, {
  id: 'compra-2',
  category: 'COMPRA',
  get categoryLabel() {
    return webText("faqs.a5cf621aa5c5.2", "Compra de Veh\xEDculos");
  },
  get question() {
    return webText("faqs.bc1527b1ce8e", "\xBFHacen peritaje?");
  },
  get answer() {
    return webText("faqs.156fb136b073", "S\xED. Todos nuestros veh\xEDculos son inspeccionados minuciosamente antes de ofrecerse al cliente. Te entregamos el carro en excelentes condiciones y con total transparencia en su historial.");
  }
}, {
  id: 'compra-3',
  category: 'COMPRA',
  get categoryLabel() {
    return webText("faqs.a5cf621aa5c5.3", "Compra de Veh\xEDculos");
  },
  get question() {
    return webText("faqs.d890c2261cb4", "\xBFPuedo hacer retoma (entregar mi carro como parte de pago)?");
  },
  get answer() {
    return webText("faqs.af235aac19dd", "S\xED. Recibimos tu veh\xEDculo como parte de pago. Lo evaluamos t\xE9cnicamente y te hacemos una oferta justa de mercado que puedes aplicar inmediatamente a la compra de tu nuevo veh\xEDculo.");
  }
}, {
  id: 'compra-4',
  category: 'COMPRA',
  get categoryLabel() {
    return webText("faqs.a5cf621aa5c5.4", "Compra de Veh\xEDculos");
  },
  get question() {
    return webText("faqs.99847b8b6859", "\xBFQu\xE9 documentos necesito para comprar un veh\xEDculo?");
  },
  get answer() {
    return webText("faqs.cab47d152ee3", "C\xE9dula de ciudadan\xEDa, comprobante de ingresos (extractos bancarios recientes o certificaci\xF3n laboral) y, si aplica seg\xFAn el an\xE1lisis de cr\xE9dito, la informaci\xF3n del codeudor.");
  }
}, {
  id: 'compra-5',
  category: 'COMPRA',
  get categoryLabel() {
    return webText("faqs.a5cf621aa5c5.5", "Compra de Veh\xEDculos");
  },
  get question() {
    return webText("faqs.5b7e8561dd0c", "\xBFLos precios son negociables?");
  },
  get answer() {
    return webText("faqs.d2eacceb9a28", "Trabajamos con precios altamente competitivos del mercado. En muchos casos existe margen razonable de negociaci\xF3n. Cons\xFAltanos directamente para brindarte la mejor oferta.");
  }
},
// SOBRE FINANCIAMIENTO
{
  id: 'fin-1',
  category: 'FINANCIAMIENTO',
  get categoryLabel() {
    return webText("faqs.9bebd8cada05", "Financiamiento");
  },
  get question() {
    return webText("faqs.d48a25c40fbe", "\xBFCon qu\xE9 bancos trabajan?");
  },
  get answer() {
    return webText("faqs.d96fdd4851f2", "Trabajamos con las principales entidades financieras del pa\xEDs: Banco Santander, Banco de Occidente, Finandina, Banco W, Bancam\xEDa y diversas cooperativas de cr\xE9dito, entre otros aliados.");
  }
}, {
  id: 'fin-2',
  category: 'FINANCIAMIENTO',
  get categoryLabel() {
    return webText("faqs.9bebd8cada05.2", "Financiamiento");
  },
  get question() {
    return webText("faqs.d46191a0c421", "\xBFTrabajan con Davivienda?");
  },
  get answer() {
    return webText("faqs.e725b2d6bfc3", "Por el momento no tenemos alianza activa con Davivienda, pero contamos con muchas otras entidades financieras aliadas que pueden ofrecerte excelentes condiciones, tasas competitivas y plazos flexibles.");
  }
}, {
  id: 'fin-3',
  category: 'FINANCIAMIENTO',
  get categoryLabel() {
    return webText("faqs.9bebd8cada05.3", "Financiamiento");
  },
  get question() {
    return webText("faqs.80224898da29", "\xBFLa consulta del cr\xE9dito afecta mi historial?");
  },
  get answer() {
    return webText("faqs.9161883b6d4f", "No. La consulta inicial de perfil crediticio con nuestros asesores no afecta tu puntaje ni historial. Solo cuando se radica formalmente ante la entidad bancaria elegida puede quedar un registro de solicitud.");
  }
}, {
  id: 'fin-4',
  category: 'FINANCIAMIENTO',
  get categoryLabel() {
    return webText("faqs.9bebd8cada05.4", "Financiamiento");
  },
  get question() {
    return webText("faqs.0ddc26cd2209", "\xBFPuedo financiar si estoy reportado en Datacr\xE9dito?");
  },
  get answer() {
    return webText("faqs.25ea4d31f58a", "Dependiendo de tu situaci\xF3n espec\xEDfica, s\xED puede haber opciones. Adem\xE1s contamos con nuestro servicio exclusivo y diferencial de Reactivaci\xF3n Financiera para ayudarte a mejorar tu perfil y buscar alternativas viables.");
  }
}, {
  id: 'fin-5',
  category: 'FINANCIAMIENTO',
  get categoryLabel() {
    return webText("faqs.9bebd8cada05.5", "Financiamiento");
  },
  get question() {
    return webText("faqs.3d6e98ee2b52", "\xBFCu\xE1nto tiempo tarda la aprobaci\xF3n del cr\xE9dito?");
  },
  get answer() {
    return webText("faqs.75dcf70834ee", "Los tiempos var\xEDan seg\xFAn cada entidad y la documentaci\xF3n suministrada, pero en la gran mayor\xEDa de casos obtenemos una respuesta preliminar o definitiva en 24 a 72 horas h\xE1biles.");
  }
}, {
  id: 'fin-6',
  category: 'FINANCIAMIENTO',
  get categoryLabel() {
    return webText("faqs.9bebd8cada05.6", "Financiamiento");
  },
  get question() {
    return webText("faqs.1cd8c7e71c08", "\xBFPuedo financiar el 100% del veh\xEDculo?");
  },
  get answer() {
    return webText("faqs.5ea49e9309e5", "Depende de tu perfil crediticio e ingresos comprobados. Algunas de nuestras entidades aliadas financian hasta el 100% del valor comercial. Nuestros asesores te orientan sin costo seg\xFAn tu caso puntual.");
  }
},
// SOBRE VENTA DE VEHÍCULOS
{
  id: 'venta-1',
  category: 'VENTA',
  get categoryLabel() {
    return webText("faqs.b24b3b7204a7", "Venta de Veh\xEDculos");
  },
  get question() {
    return webText("faqs.4a12df3db7a0", "\xBFCompran veh\xEDculos particulares?");
  },
  get answer() {
    return webText("faqs.55d0fb968d55", "S\xED. Compramos tu veh\xEDculo de contado. Realizamos una inspecci\xF3n profesional r\xE1pida y te presentamos una oferta en firme a precio justo y con pago seguro e inmediato.");
  }
}, {
  id: 'venta-2',
  category: 'VENTA',
  get categoryLabel() {
    return webText("faqs.b24b3b7204a7.2", "Venta de Veh\xEDculos");
  },
  get question() {
    return webText("faqs.7270ddd01872", "\xBFPueden vender mi carro en consignaci\xF3n?");
  },
  get answer() {
    return webText("faqs.c46dd7aa6f7f", "S\xED. Si prefieres no venderlo directamente, lo publicamos en nuestras plataformas y vitrina f\xEDsica en el C.C. Outlet Factory, encarg\xE1ndonos de toda la exhibici\xF3n, filtrado de compradores y gesti\xF3n comercial por ti.");
  }
}, {
  id: 'venta-3',
  category: 'VENTA',
  get categoryLabel() {
    return webText("faqs.b24b3b7204a7.3", "Venta de Veh\xEDculos");
  },
  get question() {
    return webText("faqs.da3f97c6f064", "\xBFPuedo vender mi veh\xEDculo si todav\xEDa est\xE1 financiado?");
  },
  get answer() {
    return webText("faqs.348cc1a14d40", "S\xED, es totalmente posible. Nuestros asesores jur\xEDdicos y comerciales te gu\xEDan paso a paso para realizar el levantamiento de prenda y la cancelaci\xF3n del saldo de forma 100% segura y transparente.");
  }
},
// SOBRE REACTIVACIÓN FINANCIERA
{
  id: 'react-1',
  category: 'REACTIVACION',
  get categoryLabel() {
    return webText("faqs.5dcfe6a11e96", "Reactivaci\xF3n Financiera \u2605");
  },
  get question() {
    return webText("faqs.ea7a9bcdf616", "\xBFQu\xE9 es la Reactivaci\xF3n Financiera?");
  },
  get answer() {
    return webText("faqs.f552c700026d", "Es un servicio exclusivo y diferencial de Autos QP en el que una consultora jur\xEDdica y financiera aliada analiza tu situaci\xF3n en centrales de riesgo (Datacr\xE9dito, TransUnion) y te orienta de forma personalizada para sanear tu historial y volver a acceder a financiamiento vehicular.");
  }
}, {
  id: 'react-2',
  category: 'REACTIVACION',
  get categoryLabel() {
    return webText("faqs.5dcfe6a11e96.2", "Reactivaci\xF3n Financiera \u2605");
  },
  get question() {
    return webText("faqs.7cfd2d140ab5", "\xBFTiene costo la consulta?");
  },
  get answer() {
    return webText("faqs.f34ca9f85924", "Cons\xFAltanos directamente a trav\xE9s de WhatsApp o nuestro formulario para conocer las condiciones vigentes de atenci\xF3n y diagn\xF3stico inicial.");
  }
}, {
  id: 'react-3',
  category: 'REACTIVACION',
  get categoryLabel() {
    return webText("faqs.5dcfe6a11e96.3", "Reactivaci\xF3n Financiera \u2605");
  },
  get question() {
    return webText("faqs.b27e55091bcb", "\xBFMi informaci\xF3n es confidencial?");
  },
  get answer() {
    return webText("faqs.c7901a15c561", "S\xED, absolutamente. Toda la informaci\xF3n personal y financiera que compartas es tratada con estricta confidencialidad bajo los lineamientos de la Ley 1581 de 2012 de Protecci\xF3n de Datos Personales.");
  }
}, {
  id: 'react-4',
  category: 'REACTIVACION',
  get categoryLabel() {
    return webText("faqs.5dcfe6a11e96.4", "Reactivaci\xF3n Financiera \u2605");
  },
  get question() {
    return webText("faqs.a426de270ea1", "\xBFCu\xE1nto tiempo toma el proceso de reactivaci\xF3n?");
  },
  get answer() {
    return webText("faqs.25abad0dae92", "Depende de la complejidad de cada caso y de las entidades involucradas. Tras la consulta inicial, nuestro equipo legal aliado te entregar\xE1 un diagn\xF3stico claro y un plan de acci\xF3n con tiempos estimados realistas.");
  }
},
// SOBRE SEGUROS Y GARANTÍA
{
  id: 'seguros-1',
  category: 'SEGUROS_GARANTIA',
  get categoryLabel() {
    return webText("faqs.de8d837b5d51", "Seguros y Garant\xEDa Mec\xE1nica");
  },
  get question() {
    return webText("faqs.497bb26c24cc", "\xBFLos veh\xEDculos incluyen garant\xEDa?");
  },
  get answer() {
    return webText("faqs.7685feb29a97", "Los veh\xEDculos se entregan inspeccionados y en las condiciones acordadas en el negocio. Adicionalmente, para modelos menores a 10 a\xF1os, tienes la posibilidad de solicitar de forma opcional una garant\xEDa mec\xE1nica especializada de caja y motor.");
  }
}, {
  id: 'seguros-2',
  category: 'SEGUROS_GARANTIA',
  get categoryLabel() {
    return webText("faqs.de8d837b5d51.2", "Seguros y Garant\xEDa Mec\xE1nica");
  },
  get question() {
    return webText("faqs.2d0dc8382333", "\xBFQui\xE9n otorga la garant\xEDa de caja y motor?");
  },
  get answer() {
    return webText("faqs.b51749cc139c", "La otorga una empresa aliada especializada (un tercero), no directamente Autos QP S.A.S. Nosotros te conectamos con el proveedor y te acompa\xF1amos durante todo el proceso de contrataci\xF3n.");
  }
}, {
  id: 'seguros-3',
  category: 'SEGUROS_GARANTIA',
  get categoryLabel() {
    return webText("faqs.de8d837b5d51.3", "Seguros y Garant\xEDa Mec\xE1nica");
  },
  get question() {
    return webText("faqs.617e821c7f3a", "\xBFTiene costo la garant\xEDa?");
  },
  get answer() {
    return webText("faqs.04ab1b549c84", "S\xED. Es un servicio opcional con valor agregado que paga el cliente; no viene incluido dentro del precio base del veh\xEDculo. Debes solicitarla al momento de la negociaci\xF3n y tu asesor te presentar\xE1 los costos y coberturas por escrito.");
  }
}, {
  id: 'seguros-4',
  category: 'SEGUROS_GARANTIA',
  get categoryLabel() {
    return webText("faqs.de8d837b5d51.4", "Seguros y Garant\xEDa Mec\xE1nica");
  },
  get question() {
    return webText("faqs.5e3cf601215c", "\xBFQu\xE9 cubre la garant\xEDa y para qu\xE9 veh\xEDculos aplica?");
  },
  get answer() {
    return webText("faqs.cd03a237ea1a", "Cubre exclusivamente componentes de caja de cambios y motor. Aplica \xFAnicamente a veh\xEDculos con a\xF1o de modelo menor a 10 a\xF1os. Las especificaciones de cobertura, vigencia y exclusiones son estipuladas por la compa\xF1\xEDa proveedora antes de contratar.");
  }
}, {
  id: 'seguros-5',
  category: 'SEGUROS_GARANTIA',
  get categoryLabel() {
    return webText("faqs.de8d837b5d51.5", "Seguros y Garant\xEDa Mec\xE1nica");
  },
  get question() {
    return webText("faqs.3fe5a7ffaa3f", "\xBFPuedo cotizar el seguro del veh\xEDculo con ustedes?");
  },
  get answer() {
    return webText("faqs.ff9af63e61d5", "S\xED. Mantenemos convenios con aseguradoras l\xEDderes como La Equidad, Mapfre, Qualitas, HDI, Zurich y Sura. Te entregamos una cotizaci\xF3n comparativa sin costo de seguro todo riesgo y SOAT para que salgas del concesionario con todo resuelto.");
  }
}];
