import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import PublicBrandLogo from '../components/PublicBrandLogo';
import { usePublicCompany } from '../utils/publicCompany';
import {
  COLOMBIA_CITY_OPTIONS,
  VEHICLE_BRANDS,
  VEHICLE_OTHER_OPTION,
  formatMoneyInput,
  getVehicleModelOptions,
  sanitizeMoneyInput,
} from '../utils/creditFormCatalogs';

const POLICY_TEXT = `AUTORIZO A AUTOS QP SAS Y A LAS ENTIDADES QUE PERTENEZCAN O LLEGAREN A PERTENECER A SU GRUPO EMPRESARIAL DE ACUERDO CON LA LEY, SUS FILIALES Y/O SUBSIDIARIAS, O A LAS ENTIDADES EN LAS CUALES ÉSTAS, DIRECTA O INDIRECTAMENTE, TENGAN PARTICIPACIÓN ACCIONARIA O SEAN ASOCIADAS, DOMICILIADAS EN COLOMBIA Y/O EN EL EXTERIOR, O A QUIEN REPRESENTE SUS DERECHOS U OSTENTE EN EL FUTURO LA CALIDAD DE ACREEDOR, CESIONARIO O CUALQUIER OTRA CALIDAD FRENTE A MÍ COMO TITULAR DE LA INFORMACIÓN, EN ADELANTE LAS ENTIDADES; Y AUTORIZO A LAS ENTIDADES FINANCIERAS ALIADAS CON LAS QUE LAS ENTIDADES CONSIDEREN Y SOSTENGAN RELACIÓN COMERCIAL, A QUIENES AUTORIZO EN FORMA PERMANENTE PARA QUE: (I) LIBEREN LA INFORMACIÓN NECESARIA QUE LES SOLICITEN SEGÚN MI PERFIL Y SUS POLÍTICAS DE OTORGAMIENTO CREDITICIO, PARA LA BÚSQUEDA DE MI CUPO DE CRÉDITO ANTE LAS ENTIDADES FINANCIERAS ALIADAS, ENTIDADES AVALADORAS U OTRAS, PARA QUE ME SEAN ENVIADAS OFERTAS O AVISOS COMERCIALES RELACIONADOS CON EL TIPO DE CRÉDITO QUE ESTOY SOLICITANDO O CON PRODUCTOS AFINES. ENTIENDO QUE LAS ENTIDADES NO ASUMEN RESPONSABILIDAD ALGUNA POR LA APROBACIÓN O NEGACIÓN DEL CRÉDITO POR PARTE DE LAS ENTIDADES FINANCIERAS ALIADAS, AVALADORAS U OTRAS, NI SE COMPROMETEN A OBTENER SU APROBACIÓN, POR CUANTO SIMPLEMENTE ACTÚAN COMO CANAL DE INFORMACIÓN ENTRE EL SOLICITANTE DEL CRÉDITO Y LA ENTIDAD FINANCIERA, LA ENTIDAD AVALADORA U OTRA. (II) SOLICITEN, CONSULTEN, COMPARTAN, INFORMEN, REPORTEN, PROCESEN, MODIFIQUEN, ACTUALICEN, ACLAREN, RETIREN O DIVULGUEN, ANTE LAS ENTIDADES DE CONSULTA DE BASES DE DATOS U OPERADORES DE INFORMACIÓN Y RIESGO, O ANTE CUALQUIER ENTIDAD QUE MANEJE O ADMINISTRE BASES DE DATOS CON LOS FINES LEGALMENTE DEFINIDOS PARA ESTE TIPO DE ENTIDADES, TODO LO REFERENTE A MI INFORMACIÓN FINANCIERA, COMERCIAL Y CREDITICIA, PRESENTE, PASADA O FUTURA, MI ENDEUDAMIENTO Y EL NACIMIENTO, MODIFICACIÓN Y EXTINCIÓN DE MIS DERECHOS Y OBLIGACIONES ORIGINADOS EN VIRTUD DE CUALQUIER CONTRATO CELEBRADO U OPERACIÓN REALIZADA O QUE LLEGARE A CELEBRAR O REALIZAR CON CUALQUIERA DE LAS ENTIDADES. (III) CONSULTEN, SOLICITEN O VERIFIQUEN INFORMACIÓN SOBRE MIS DATOS DE UBICACIÓN O CONTACTO, LOS BIENES O DERECHOS QUE POSEO O LLEGARE A POSEER Y QUE REPOSEN EN BASES DE DATOS DE ENTIDADES PÚBLICAS O PRIVADAS, O QUE CONOZCAN PERSONAS NATURALES O JURÍDICAS, O SE ENCUENTREN EN BUSCADORES PÚBLICOS, REDES SOCIALES O PUBLICACIONES FÍSICAS O ELECTRÓNICAS, BIEN SEA EN COLOMBIA O EN EL EXTERIOR. (IV) ME CONTACTEN A TRAVÉS DEL ENVÍO DE MENSAJES A MI TERMINAL MÓVIL DE TELECOMUNICACIONES Y/O A TRAVÉS DE CORREO ELECTRÓNICO Y/O REDES SOCIALES EN LAS CUALES ESTÉ INSCRITO. (V) CONSERVEN MI INFORMACIÓN Y DOCUMENTACIÓN AUN CUANDO NO SE HAYA PERFECCIONADO UNA RELACIÓN CONTRACTUAL O DESPUÉS DE FINALIZADA LA MISMA CON CUALQUIERA DE LAS ENTIDADES, IGUALMENTE PARA RECOLECTARLA, ACTUALIZARLA, MODIFICARLA, PROCESARLA Y ELIMINARLA DE CONFORMIDAD CON LA LEY APLICABLE. (VI) LAS ENTIDADES COMPARTAN, REMITAN Y ACCEDAN ENTRE SÍ A MI INFORMACIÓN O DOCUMENTACIÓN CONSIGNADA O ANEXA EN LAS SOLICITUDES DE VINCULACIÓN, ACTUALIZACIONES EN LOS DIFERENTES DOCUMENTOS DE DEPÓSITO Y/O CRÉDITO, OPERACIONES Y/O SISTEMAS DE INFORMACIÓN, ASÍ COMO INFORMACIÓN Y/O DOCUMENTACIÓN RELACIONADA CON LOS PRODUCTOS Y/O SERVICIOS QUE POSEO EN CUALQUIERA DE ELLAS. (VII) ELABOREN ESTADÍSTICAS Y DERIVEN MEDIANTE MODELOS MATEMÁTICOS CONCLUSIONES A PARTIR DE ELLAS. DECLARO HABER LEÍDO CUIDADOSAMENTE EL CONTENIDO DE ESTA CLÁUSULA Y HABERLA COMPRENDIDO A CABALIDAD, RAZÓN POR LA CUAL ENTIENDO SUS ALCANCES E IMPLICACIONES.`;

const STEP_TITLES = [
  'Datos del Vehículo',
  'Datos Personales',
  'Datos Laborales',
  'Ingresos',
  'Referencias',
  'Consentimiento y Firma',
];

const FORM_DRAFT_TTL_MS = 30 * 60 * 1000;
const FORM_DRAFT_STORAGE_PREFIX = 'autosqp_public_credit_form_draft';

const getBogotaCurrentDate = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

const formatBogotaDateLabel = (dateValue) => {
  if (!dateValue) return '';
  const [year, month, day] = String(dateValue).split('-');
  if (!year || !month || !day) return dateValue;
  return `${day}/${month}/${year}`;
};

const createEmptyForm = () => ({
  vehicle: {
    vehicleValue: '',
    requestedAmount: '',
    requestDate: getBogotaCurrentDate(),
    make: '',
    model: '',
    vehicleType: 'Automóvil',
  },
  personal: {
    firstName: '',
    lastName: '',
    documentType: 'C.C',
    documentNumber: '',
    issuePlace: '',
    birthDate: '',
    gender: 'M',
    profession: '',
    birthPlace: '',
    maritalStatus: 'Soltero',
    childrenCount: 'Sin Hijos',
    educationLevel: 'Primaria',
    livesWith: 'Cónyuge',
    housingType: 'Familiar',
    mobilePhone: '',
    city: '',
    address: '',
    email: '',
  },
  employment: {
    activity: 'Empleado',
    companyName: '',
    companyCity: '',
    companyAddress: '',
    jobTitle: '',
    companyEmail: '',
    startDate: '',
    salary: '',
    contractType: 'Indefinido',
    previousCompanyName: '',
    previousCompanyActivity: '',
    previousCompanyRole: '',
    previousEmploymentTime: '0 a 6 Meses',
  },
  income: {
    salaryIncome: '',
    commissionsIncome: '',
    otherIncome: '',
    otherIncomeDetail: '',
    totalIncome: '',
  },
  references: {
    commercial: { names: '', lastNames: '', phone: '', city: '' },
    personal1: { names: '', lastNames: '', phone: '', city: '' },
    personal2: { names: '', lastNames: '', phone: '', city: '' },
  },
  consent: {
    accepted: false,
    signatureMode: 'draw',
    signatureName: '',
    verificationCode: '',
    signatureDrawnDataUrl: '',
  },
});

const mergeCreditForm = (source = {}) => {
  const defaults = createEmptyForm();
  return {
    vehicle: { ...defaults.vehicle, ...(source.vehicle || {}) },
    personal: { ...defaults.personal, ...(source.personal || {}) },
    employment: { ...defaults.employment, ...(source.employment || {}) },
    income: { ...defaults.income, ...(source.income || {}) },
    references: {
      ...defaults.references,
      ...(source.references || {}),
      commercial: { ...defaults.references.commercial, ...(source.references?.commercial || {}) },
      personal1: { ...defaults.references.personal1, ...(source.references?.personal1 || {}) },
      personal2: { ...defaults.references.personal2, ...(source.references?.personal2 || {}) },
    },
    consent: {
      ...defaults.consent,
      ...(source.consent || {}),
      verificationCode: '',
      signatureDrawnDataUrl: '',
    },
  };
};

const withAlpha = (hex, alpha = '18') => {
  if (typeof hex !== 'string') return hex;
  const normalized = hex.trim();
  if (!normalized.startsWith('#')) return normalized;
  if (normalized.length === 7) return `${normalized}${alpha}`;
  if (normalized.length === 4) {
    const expanded = `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
    return `${expanded}${alpha}`;
  }
  return normalized;
};

const filePreviewUrl = (file) => (file ? URL.createObjectURL(file) : '');

const buildCapturePageUrl = (token) => {
  if (typeof window === 'undefined' || !token) return '';
  const basePath = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${window.location.origin}${basePath}/credito/captura/${token}`;
};

const buildQrImageUrl = (url) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(url)}`;

const buildVehicleLabel = (vehicle) => {
  return [vehicle.make, vehicle.model, vehicle.vehicleType].filter(Boolean).join(' ').trim();
};

const getPublicBrandName = (companyName) => {
  const normalized = String(companyName || 'AutosQP').trim();
  return normalized.replace(/\s+(admin|administrador)$/i, '').trim() || normalized;
};

const stripSensitiveDraftFields = (formValue) => ({
  ...formValue,
  consent: {
    ...(formValue?.consent || {}),
    verificationCode: '',
    signatureDrawnDataUrl: '',
  },
});

const readStoredDraft = (storageKey) => {
  if (typeof window === 'undefined') return null;
  try {
    const rawValue = window.sessionStorage.getItem(storageKey);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue);
    if (!parsed?.savedAt || Date.now() - Number(parsed.savedAt) > FORM_DRAFT_TTL_MS) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }
    return parsed.form && typeof parsed.form === 'object'
      ? { form: parsed.form, step: Number(parsed.step) || 0 }
      : null;
  } catch {
    return null;
  }
};

const writeStoredDraft = (storageKey, formValue, stepValue) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      savedAt: Date.now(),
      step: stepValue,
      form: stripSensitiveDraftFields(formValue),
    }));
  } catch {
    // Storage can be unavailable in private browsing; the form should still work.
  }
};

const PublicCreditForm = () => {
  const company = usePublicCompany();
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const accessToken = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('access') || '';
  }, []);
  const draftStorageKey = useMemo(
    () => `${FORM_DRAFT_STORAGE_PREFIX}:${accessToken || 'public'}`,
    [accessToken]
  );

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(createEmptyForm);
  const [otherBrandMode, setOtherBrandMode] = useState(false);
  const [otherModelMode, setOtherModelMode] = useState(false);
  const [accessContext, setAccessContext] = useState(null);
  const [accessAttachments, setAccessAttachments] = useState({});
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [documentFront, setDocumentFront] = useState(null);
  const [documentBack, setDocumentBack] = useState(null);
  const [documentCaptures, setDocumentCaptures] = useState({ documentFront: null, documentBack: null });
  const [signatureCapture, setSignatureCapture] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [documentFrontPreview, setDocumentFrontPreview] = useState('');
  const [documentBackPreview, setDocumentBackPreview] = useState('');
  const [signaturePreview, setSignaturePreview] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationVerified, setVerificationVerified] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creatingCapture, setCreatingCapture] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [draftReady, setDraftReady] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const enabledModules = new Set(Array.isArray(company?.enabled_modules) ? company.enabled_modules : []);
  const isEnabled = enabledModules.has('public_credit_form');
  const requiresEmailValidation = accessContext?.requires_email_validation ?? company?.public_credit_requires_email_validation ?? true;
  const vehicleModelOptions = useMemo(() => getVehicleModelOptions(form.vehicle.make), [form.vehicle.make]);

  const theme = useMemo(() => {
    const primary = company?.primary_color || '#2563eb';
    const secondary = company?.secondary_color || '#0f172a';
    const header = company?.public_header_color || secondary;
    const headerText = company?.public_header_text_color || '#ffffff';
    const body = company?.public_body_color || '#f8fafc';
    const text = company?.public_body_text_color || '#0f172a';
    return {
      primary,
      secondary,
      header,
      headerText,
      body,
      text,
      primarySoft: withAlpha(primary, '14'),
      primaryBorder: withAlpha(primary, '38'),
      secondarySoft: withAlpha(secondary, '12'),
    };
  }, [company]);

  useEffect(() => {
    if (!accessToken) return undefined;
    let active = true;
    const loadAccess = async () => {
      setLoadingAccess(true);
      try {
        const response = await axios.get(`/api/public/credit-request/access/${accessToken}`);
        if (!active) return;
        setAccessContext(response.data || null);
        setAccessAttachments(response.data?.attachments || {});
        setForm(mergeCreditForm(response.data?.form_payload || {}));
        setVerificationSent(true);
        setVerificationVerified(!response.data?.requires_email_validation || Boolean(response.data?.verified));
        setStatus({
          type: 'success',
          message: response.data?.requires_email_validation
            ? 'Acceso ligado al lead cargado. Ingresa el código recibido por correo para validar y firmar.'
            : 'Acceso ligado al lead cargado. Revisa la información pendiente y firma el formulario.',
        });
      } catch (error) {
        if (!active) return;
        setStatus({
          type: 'error',
          message: error?.response?.data?.detail || 'No se pudo abrir el acceso enviado por el asesor.',
        });
      } finally {
        if (active) setLoadingAccess(false);
      }
    };
    loadAccess();
    return () => { active = false; };
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      return;
    }
    const storedDraft = readStoredDraft(draftStorageKey);
    if (storedDraft?.form) {
      setForm(mergeCreditForm(storedDraft.form));
      setStep(Math.max(0, Math.min(storedDraft.step || 0, STEP_TITLES.length - 1)));
      setStatus({ type: 'success', message: 'Restauramos un borrador reciente de este formulario.' });
    }
    setDraftReady(true);
  }, [accessToken, draftStorageKey]);

  useEffect(() => {
    if (!accessToken || loadingAccess) return;
    const storedDraft = readStoredDraft(draftStorageKey);
    if (storedDraft?.form) {
      setForm((current) => mergeCreditForm({
        vehicle: { ...current.vehicle, ...(storedDraft.form.vehicle || {}) },
        personal: { ...current.personal, ...(storedDraft.form.personal || {}) },
        employment: { ...current.employment, ...(storedDraft.form.employment || {}) },
        income: { ...current.income, ...(storedDraft.form.income || {}) },
        references: { ...current.references, ...(storedDraft.form.references || {}) },
        consent: { ...current.consent, ...(storedDraft.form.consent || {}) },
      }));
      setStep(Math.max(0, Math.min(storedDraft.step || 0, STEP_TITLES.length - 1)));
      setStatus({ type: 'success', message: 'Restauramos un borrador reciente de este acceso.' });
    }
    setDraftReady(true);
  }, [accessToken, draftStorageKey, loadingAccess]);

  useEffect(() => {
    if (!draftReady || submitting) return undefined;
    const timeoutId = window.setTimeout(() => {
      writeStoredDraft(draftStorageKey, form, step);
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [draftReady, draftStorageKey, form, step, submitting]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = theme.secondary;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, [theme.secondary]);

  useEffect(() => () => {
    if (documentFrontPreview) URL.revokeObjectURL(documentFrontPreview);
    if (documentBackPreview) URL.revokeObjectURL(documentBackPreview);
    if (signaturePreview) URL.revokeObjectURL(signaturePreview);
  }, [documentFrontPreview, documentBackPreview, signaturePreview]);

  useEffect(() => {
    const pendingCaptures = [
      ...Object.entries(documentCaptures),
      ['signature', signatureCapture],
    ].filter(([, capture]) => capture?.token && !capture?.uploaded);
    if (!pendingCaptures.length) return undefined;

    const intervalId = window.setInterval(async () => {
      await Promise.all(pendingCaptures.map(async ([key, capture]) => {
        try {
          const response = await axios.get(`/api/public/credit-request/capture-session/${capture.token}`);
          if (response?.data?.uploaded) {
            if (key === 'signature') {
              setSignatureCapture((prev) => ({
                ...prev,
                ...response.data,
                previewUrl: response.data.file_url,
              }));
              updateSection('consent', 'signatureMode', 'upload');
            } else {
              setDocumentCaptures((prev) => ({
                ...prev,
                [key]: {
                  ...prev[key],
                  ...response.data,
                  previewUrl: response.data.file_url,
                },
              }));
            }
          }
        } catch {
          if (key === 'signature') {
            setSignatureCapture((prev) => ({
              ...prev,
              error: 'No se pudo consultar la captura. Genera un nuevo QR.',
            }));
          } else {
            setDocumentCaptures((prev) => ({
              ...prev,
              [key]: {
                ...prev[key],
                error: 'No se pudo consultar la captura. Genera un nuevo QR.',
              },
            }));
          }
        }
      }));
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [documentCaptures, signatureCapture]);

  useEffect(() => {
    setForm((prev) => {
      const salaryIncome = Number(String(prev.employment.salary || '').replace(/[^\d.-]/g, '')) || 0;
      const commissionsIncome = Number(String(prev.income.commissionsIncome || '').replace(/[^\d.-]/g, '')) || 0;
      const otherIncome = Number(String(prev.income.otherIncome || '').replace(/[^\d.-]/g, '')) || 0;
      const nextTotal = salaryIncome + commissionsIncome + otherIncome;
      const nextValue = nextTotal > 0 ? String(nextTotal) : '';

      if (prev.income.salaryIncome === prev.employment.salary && prev.income.totalIncome === nextValue) {
        return prev;
      }

      return {
        ...prev,
        income: {
          ...prev.income,
          salaryIncome: prev.employment.salary,
          totalIncome: nextValue,
        },
      };
    });
  }, [form.employment.salary, form.income.commissionsIncome, form.income.otherIncome]);

  const updateSection = (section, key, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  const updateMoneySection = (section, key, value) => {
    updateSection(section, key, sanitizeMoneyInput(value));
  };

  const updateReference = (referenceKey, field, value) => {
    setForm((prev) => ({
      ...prev,
      references: {
        ...prev.references,
        [referenceKey]: {
          ...prev.references[referenceKey],
          [field]: value,
        },
      },
    }));
  };

  const inputClassName = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2';
  const requiredInputClassName = `${inputClassName} border-red-200 bg-red-50/30 focus:ring-red-200`;
  const renderFieldLabel = (label, required = false) => (
    <label className="mb-1 block text-sm font-semibold text-slate-700">
      {label}
      {required ? <span className="ml-1 text-red-500">(Obligatorio)</span> : null}
    </label>
  );

  const resetStatus = () => setStatus({ type: '', message: '' });

  const validateStep = (stepIndex) => {
    if (stepIndex === 0) {
      const { vehicleValue, requestedAmount, requestDate, make, model } = form.vehicle;
      return Boolean(vehicleValue && requestedAmount && requestDate && make && model);
    }
    if (stepIndex === 1) {
      const { firstName, lastName, documentNumber, mobilePhone, address, email } = form.personal;
      const hasFrontDocument = Boolean(documentFront || documentCaptures.documentFront?.uploaded || accessAttachments.document_front);
      const hasBackDocument = Boolean(documentBack || documentCaptures.documentBack?.uploaded || accessAttachments.document_back);
      return Boolean(firstName && lastName && documentNumber && mobilePhone && address && email && hasFrontDocument && hasBackDocument);
    }
    if (stepIndex === 2) {
      const { activity, companyName, salary } = form.employment;
      return Boolean(activity && companyName && salary);
    }
    if (stepIndex === 3) {
      const { totalIncome } = form.income;
      return Boolean(form.employment.salary && totalIncome);
    }
    if (stepIndex === 4) {
      const { personal1, personal2 } = form.references;
      return Boolean(personal1.names && personal1.phone && personal2.names && personal2.phone);
    }
    if (stepIndex === 5) {
      const hasDrawnSignature = Boolean(form.consent.signatureDrawnDataUrl);
      const hasUploadedSignature = Boolean(signatureFile);
      const hasQrSignature = Boolean(signatureCapture?.uploaded || accessAttachments.signature_upload);
      return Boolean(
        form.consent.accepted &&
        form.consent.signatureName &&
        (!requiresEmailValidation || verificationVerified) &&
        ((form.consent.signatureMode === 'draw' && hasDrawnSignature) ||
          (form.consent.signatureMode === 'upload' && (hasUploadedSignature || hasQrSignature)))
      );
    }
    return true;
  };

  const nextStep = () => {
    resetStatus();
    if (!validateStep(step)) {
      setStatus({ type: 'error', message: 'Completa los campos obligatorios antes de continuar.' });
      return;
    }
    setStep((prev) => Math.min(prev + 1, STEP_TITLES.length - 1));
  };

  const prevStep = () => {
    resetStatus();
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    updateSection('consent', 'signatureDrawnDataUrl', '');
  };

  const getCanvasPosition = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0];
    const clientX = touch ? touch.clientX : event.clientX;
    const clientY = touch ? touch.clientY : event.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (event) => {
    drawingRef.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasPosition(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasPosition(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    updateSection('consent', 'signatureDrawnDataUrl', canvas.toDataURL('image/png'));
  };

  const stopDrawing = () => {
    drawingRef.current = false;
  };

  const handleFileSelection = (type, file) => {
    if (!file) return;
    if (type === 'documentFront') {
      if (documentFrontPreview) URL.revokeObjectURL(documentFrontPreview);
      setDocumentFront(file);
      setDocumentFrontPreview(filePreviewUrl(file));
      setDocumentCaptures((prev) => ({ ...prev, documentFront: null }));
    }
    if (type === 'documentBack') {
      if (documentBackPreview) URL.revokeObjectURL(documentBackPreview);
      setDocumentBack(file);
      setDocumentBackPreview(filePreviewUrl(file));
      setDocumentCaptures((prev) => ({ ...prev, documentBack: null }));
    }
    if (type === 'signatureFile') {
      if (signaturePreview) URL.revokeObjectURL(signaturePreview);
      setSignatureFile(file);
      setSignaturePreview(filePreviewUrl(file));
      setSignatureCapture(null);
      updateSection('consent', 'signatureMode', 'upload');
    }
  };

  const createCaptureSession = async (type) => {
    resetStatus();
    const side = type === 'documentFront' ? 'front' : type === 'documentBack' ? 'back' : 'signature';
    setCreatingCapture(type);
    try {
      const response = await axios.post('/api/public/credit-request/capture-session', { side });
      const captureData = {
          ...response.data,
          captureUrl: buildCapturePageUrl(response.data.token),
          previewUrl: response.data.file_url || '',
          error: '',
      };
      if (type === 'signature') {
        setSignatureCapture(captureData);
        setSignatureFile(null);
        setSignaturePreview('');
        updateSection('consent', 'signatureMode', 'upload');
      } else {
        setDocumentCaptures((prev) => ({
          ...prev,
          [type]: captureData,
        }));
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: error?.response?.data?.detail || 'No se pudo generar el QR de captura.',
      });
    } finally {
      setCreatingCapture('');
    }
  };

  const sendVerificationCode = async () => {
    resetStatus();
    if (!requiresEmailValidation) {
      setVerificationSent(true);
      setVerificationVerified(true);
      setStatus({ type: 'success', message: 'Esta empresa no requiere código de validación por correo.' });
      return;
    }
    if (accessToken) {
      setVerificationSent(true);
      setStatus({ type: 'success', message: 'Usa el código de validación que recibiste junto con este enlace.' });
      return;
    }
    if (!form.personal.email) {
      setStatus({ type: 'error', message: 'Debes diligenciar el correo antes de solicitar el código.' });
      return;
    }
    setSendingCode(true);
    try {
      await axios.post('/api/public/credit-request/send-code', { email: form.personal.email });
      setVerificationSent(true);
      setVerificationVerified(false);
      setStatus({ type: 'success', message: 'Se envió un código de verificación al correo indicado.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error?.response?.data?.detail || 'No se pudo enviar el código de verificación.',
      });
    } finally {
      setSendingCode(false);
    }
  };

  const verifyCode = async () => {
    resetStatus();
    if (!requiresEmailValidation) {
      setVerificationSent(true);
      setVerificationVerified(true);
      setStatus({ type: 'success', message: 'Esta empresa no requiere código de validación por correo.' });
      return;
    }
    if (!form.consent.verificationCode) {
      setStatus({ type: 'error', message: 'Ingresa el código recibido por correo.' });
      return;
    }
    setVerifyingCode(true);
    try {
      if (accessToken) {
        await axios.post(`/api/public/credit-request/access/${accessToken}/verify-code`, {
          email: form.personal.email,
          code: form.consent.verificationCode,
        });
      } else {
        await axios.post('/api/public/credit-request/verify-code', {
          email: form.personal.email,
          code: form.consent.verificationCode,
        });
      }
      setVerificationVerified(true);
      setStatus({ type: 'success', message: 'Correo validado correctamente.' });
    } catch (error) {
      setVerificationVerified(false);
      setStatus({
        type: 'error',
        message: error?.response?.data?.detail || 'No se pudo validar el código.',
      });
    } finally {
      setVerifyingCode(false);
    }
  };

  const buildPayload = () => {
    const referencesSummary = [
      form.references.commercial.names ? `Ref. comercial: ${form.references.commercial.names} ${form.references.commercial.lastNames}`.trim() : '',
      form.references.personal1.names ? `Ref. personal 1: ${form.references.personal1.names} ${form.references.personal1.lastNames}`.trim() : '',
      form.references.personal2.names ? `Ref. personal 2: ${form.references.personal2.names} ${form.references.personal2.lastNames}`.trim() : '',
    ]
      .filter(Boolean)
      .join(' | ');

    return {
      vehicle: {
        ...form.vehicle,
        label: buildVehicleLabel(form.vehicle),
      },
      personal: form.personal,
      employment: form.employment,
      income: form.income,
      references: {
        ...form.references,
        summary: referencesSummary,
      },
      consent: form.consent,
    };
  };

  const resetFormState = () => {
    setForm(createEmptyForm());
    setDocumentFront(null);
    setDocumentBack(null);
    setDocumentCaptures({ documentFront: null, documentBack: null });
    setSignatureCapture(null);
    setSignatureFile(null);
    setVerificationSent(false);
    setVerificationVerified(false);
    setStep(0);
    clearCanvas();
    if (documentFrontPreview) URL.revokeObjectURL(documentFrontPreview);
    if (documentBackPreview) URL.revokeObjectURL(documentBackPreview);
    if (signaturePreview) URL.revokeObjectURL(signaturePreview);
    setDocumentFrontPreview('');
    setDocumentBackPreview('');
    setSignaturePreview('');
  };

  const startAnotherForm = () => {
    window.sessionStorage.removeItem(draftStorageKey);
    resetFormState();
    setStatus({ type: '', message: '' });
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    resetStatus();
    if (!validateStep(5)) {
      setStatus({
        type: 'error',
        message: requiresEmailValidation
          ? 'Completa la validación, la firma y la aceptación de la política antes de enviar.'
          : 'Completa la firma y la aceptación de la política antes de enviar.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload();
      const formData = new FormData();
      formData.append('payload_json', JSON.stringify(payload));
      if (documentFront) formData.append('document_front', documentFront);
      if (documentBack) formData.append('document_back', documentBack);
      if (!documentFront && documentCaptures.documentFront?.uploaded) {
        formData.append('document_front_capture_token', documentCaptures.documentFront.token);
      }
      if (!documentBack && documentCaptures.documentBack?.uploaded) {
        formData.append('document_back_capture_token', documentCaptures.documentBack.token);
      }
      if (signatureFile) formData.append('signature_file', signatureFile);
      if (!signatureFile && signatureCapture?.uploaded) {
        formData.append('signature_capture_token', signatureCapture.token);
      }
      if (accessToken) formData.append('access_token', accessToken);

      const response = await axios.post('/api/public/credit-request/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      window.sessionStorage.removeItem(draftStorageKey);
      resetFormState();
      setStatus({ type: '', message: '' });
      setSubmitted(true);
    } catch (error) {
      setStatus({
        type: 'error',
        message: error?.response?.data?.detail || 'No se pudo enviar la solicitud de crédito.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const brandName = getPublicBrandName(company?.name);
  const progress = ((step + 1) / STEP_TITLES.length) * 100;
  const selectedVehicleBrand = otherBrandMode
    ? VEHICLE_OTHER_OPTION
    : VEHICLE_BRANDS.includes(form.vehicle.make)
    ? form.vehicle.make
    : form.vehicle.make
      ? VEHICLE_OTHER_OPTION
      : '';
  const selectedVehicleModel = otherModelMode
    ? VEHICLE_OTHER_OPTION
    : vehicleModelOptions.includes(form.vehicle.model)
    ? form.vehicle.model
    : form.vehicle.model
      ? VEHICLE_OTHER_OPTION
      : '';

  const renderPreviewBox = (label, preview, file) => (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {preview ? (
        <img src={preview} alt={label} className="h-36 w-full rounded-xl object-cover" />
      ) : (
        <div className="flex h-36 items-center justify-center rounded-xl bg-white text-sm text-slate-400">
          Sin vista previa
        </div>
      )}
      {file && <p className="mt-2 truncate text-xs text-slate-500">{file.name}</p>}
    </div>
  );

  const renderCaptureBox = (type, label) => {
    const capture = type === 'signature' ? signatureCapture : documentCaptures[type];
    const captureUrl = capture?.captureUrl || buildCapturePageUrl(capture?.token);
    const isUploaded = Boolean(capture?.uploaded && capture?.file_url);
    const isSignature = type === 'signature';

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900">{isSignature ? 'Firmar desde celular' : 'Capturar desde celular'}</p>
            <p className="text-xs text-slate-500">Genera un QR para {isSignature ? 'firmar desde el teléfono' : `abrir la cámara del teléfono y subir ${label.toLowerCase()}`}.</p>
          </div>
          <button
            type="button"
            onClick={() => createCaptureSession(type)}
            disabled={creatingCapture === type}
            className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: theme.secondary }}
          >
            {creatingCapture === type ? 'Generando...' : capture?.token ? 'Nuevo QR' : 'Generar QR'}
          </button>
        </div>

        {capture?.token && (
          <div className="mt-4 grid gap-4 md:grid-cols-[auto_1fr]">
            <img
              src={buildQrImageUrl(captureUrl)}
              alt={`QR ${label}`}
              className="h-44 w-44 rounded-2xl border border-slate-200 bg-white p-2"
            />
            <div className="space-y-3 text-sm text-slate-600">
              <p>{isSignature ? 'Escanea este QR con el celular, toma o selecciona la imagen de la firma. Esta pantalla detecta la carga automáticamente.' : 'Escanea este QR con el celular y toma la foto. Esta pantalla detecta la carga automáticamente.'}</p>
              <a href={captureUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700">
                Abrir enlace de captura
              </a>
              {isUploaded ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-700">
                  {isSignature ? 'Firma recibida correctamente.' : 'Foto recibida correctamente.'}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-semibold text-amber-700">
                  {isSignature ? 'Esperando firma desde el celular...' : 'Esperando foto desde el celular...'}
                </div>
              )}
              {capture?.error && <p className="text-sm font-semibold text-red-600">{capture.error}</p>}
            </div>
          </div>
        )}

        {isUploaded && renderPreviewBox(`${label} recibida por QR`, capture.file_url, { name: capture.original_file_name || (isSignature ? 'firma_cliente.jpg' : 'foto_cedula.jpg') })}
      </div>
    );
  };

  return (
    <div className="public-theme-scope min-h-screen" style={{ '--public-body-text': theme.text, background: theme.body, color: theme.text }}>
      <header className="sticky top-0 z-40 border-b backdrop-blur" style={{ backgroundColor: theme.header, borderColor: theme.primarySoft, color: theme.headerText }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/autos" className="flex items-center gap-3">
            <PublicBrandLogo
              company={company}
              brandName={brandName}
              className="h-12 w-auto object-contain"
              fallbackClassName="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-black text-white"
              showText={false}
              primaryColor={theme.primary}
              secondaryColor={theme.secondary}
            />
            <span className="text-2xl font-black" style={{ color: theme.headerText }}>{brandName}</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/autos" className="rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: theme.primaryBorder, color: theme.headerText }}>
              Ver inventario
            </Link>
            <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-bold" style={{ backgroundColor: theme.primary, color: theme.headerText }}>
              Ingresa
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10">
        <datalist id="credit-vehicle-brands">
          {VEHICLE_BRANDS.map((brand) => <option key={brand} value={brand} />)}
        </datalist>
        <datalist id="credit-vehicle-models">
          {vehicleModelOptions.map((model) => <option key={model} value={model} />)}
        </datalist>
        <datalist id="credit-colombia-cities">
          {COLOMBIA_CITY_OPTIONS.map((city) => <option key={city} value={city} />)}
        </datalist>
        {submitted ? (
          <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-2xl md:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-3xl font-black text-emerald-600">
              ✓
            </div>
            <h1 className="mt-6 text-3xl font-black text-slate-900 md:text-4xl">Formulario enviado</h1>
            <p className="mx-auto mt-3 max-w-xl text-base text-slate-600">
              Recibimos tu solicitud de crédito correctamente. El equipo comercial revisará la información y continuará el seguimiento.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/autos" className="rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ backgroundColor: theme.primary }}>
                Ver inventario
              </Link>
              <button type="button" onClick={startAnotherForm} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">
                Enviar otro formulario
              </button>
            </div>
          </div>
        ) : (
        <div className="rounded-[2rem] bg-white p-6 shadow-2xl md:p-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8">
              <h1 className="text-4xl font-black text-slate-900">Formulario de Crédito</h1>
              <p className="mt-2 text-slate-500">Paso {step + 1} de {STEP_TITLES.length}</p>
              <p className="mt-2 text-sm font-medium text-red-500">Los campos marcados como obligatorios deben completarse para continuar.</p>
              <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
                <div className="h-2 rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: theme.primary }} />
              </div>
            </div>

            {status.message && (
              <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
                status.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}>
                {status.message}
              </div>
            )}

            {accessToken && (
              <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800">
                <strong>Acceso enviado por asesor.</strong> Este formulario quedará enlazado al lead en gestión
                {accessContext?.applicant_name ? ` de ${accessContext.applicant_name}` : ''}. Usa el código recibido por correo para validar y firmar.
              </div>
            )}

            {loadingAccess ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center text-slate-500">
                Cargando acceso del formulario...
              </div>
            ) : !isEnabled ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-700">
                El formulario público de crédito no está habilitado para esta empresa.
              </div>
            ) : (
              <>
                {step === 0 && (
                  <section className="space-y-6">
                    <h2 className="border-b pb-3 text-2xl font-bold text-slate-900">{STEP_TITLES[0]}</h2>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        {renderFieldLabel('Valor Vehículo $', true)}
                        <input inputMode="numeric" className={requiredInputClassName} value={formatMoneyInput(form.vehicle.vehicleValue)} onChange={(e) => updateMoneySection('vehicle', 'vehicleValue', e.target.value)} />
                      </div>
                      <div>
                        {renderFieldLabel('Monto Solicitado $', true)}
                        <input inputMode="numeric" className={requiredInputClassName} value={formatMoneyInput(form.vehicle.requestedAmount)} onChange={(e) => updateMoneySection('vehicle', 'requestedAmount', e.target.value)} />
                      </div>
                      <div>
                        {renderFieldLabel('Fecha de Solicitud', true)}
                        <input className={`${requiredInputClassName} bg-slate-100 text-slate-600`} value={formatBogotaDateLabel(form.vehicle.requestDate)} readOnly />
                        <p className="mt-1 text-xs text-slate-500">Fecha automática según Bogotá, Colombia.</p>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        {renderFieldLabel('Marca', true)}
                        <select
                          className={requiredInputClassName}
                          value={selectedVehicleBrand}
                          onChange={(e) => {
                            const isOther = e.target.value === VEHICLE_OTHER_OPTION;
                            setOtherBrandMode(isOther);
                            setOtherModelMode(false);
                            updateSection('vehicle', 'make', e.target.value === VEHICLE_OTHER_OPTION ? '' : e.target.value);
                            updateSection('vehicle', 'model', '');
                          }}
                        >
                          <option value="">Selecciona una marca</option>
                          {VEHICLE_BRANDS.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                        </select>
                        {selectedVehicleBrand === VEHICLE_OTHER_OPTION && (
                          <input className={`${requiredInputClassName} mt-2`} placeholder="Escribe la marca" value={form.vehicle.make} onChange={(e) => updateSection('vehicle', 'make', e.target.value)} />
                        )}
                      </div>
                      <div>
                        {renderFieldLabel('Modelo', true)}
                        <select
                          className={requiredInputClassName}
                          value={selectedVehicleModel}
                          onChange={(e) => {
                            const isOther = e.target.value === VEHICLE_OTHER_OPTION;
                            setOtherModelMode(isOther);
                            updateSection('vehicle', 'model', isOther ? '' : e.target.value);
                          }}
                        >
                          <option value="">Selecciona un modelo</option>
                          {vehicleModelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
                        </select>
                        {selectedVehicleModel === VEHICLE_OTHER_OPTION && (
                          <input className={`${requiredInputClassName} mt-2`} placeholder="Escribe el modelo" value={form.vehicle.model} onChange={(e) => updateSection('vehicle', 'model', e.target.value)} />
                        )}
                      </div>
                      <div>
                        {renderFieldLabel('Tipo')}
                        <select className={inputClassName} value={form.vehicle.vehicleType} onChange={(e) => updateSection('vehicle', 'vehicleType', e.target.value)}>
                          <option>Automóvil</option>
                          <option>Camioneta</option>
                          <option>SUV</option>
                          <option>Camión</option>
                          <option>Moto</option>
                        </select>
                      </div>
                    </div>
                  </section>
                )}

                {step === 1 && (
                  <section className="space-y-6">
                    <h2 className="border-b pb-3 text-2xl font-bold text-slate-900">{STEP_TITLES[1]}</h2>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div>{renderFieldLabel('Nombres', true)}<input className={requiredInputClassName} value={form.personal.firstName} onChange={(e) => updateSection('personal', 'firstName', e.target.value)} /></div>
                      <div>{renderFieldLabel('Apellidos', true)}<input className={requiredInputClassName} value={form.personal.lastName} onChange={(e) => updateSection('personal', 'lastName', e.target.value)} /></div>
                      <div>{renderFieldLabel('Documento')}<select className={inputClassName} value={form.personal.documentType} onChange={(e) => updateSection('personal', 'documentType', e.target.value)}><option>C.C</option><option>C.E</option><option>Pasaporte</option><option>NIT</option></select></div>
                      <div>{renderFieldLabel('N° Documento', true)}<input className={requiredInputClassName} value={form.personal.documentNumber} onChange={(e) => updateSection('personal', 'documentNumber', e.target.value)} /></div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">Lugar Expedición</label><input list="credit-colombia-cities" className={inputClassName} value={form.personal.issuePlace} onChange={(e) => updateSection('personal', 'issuePlace', e.target.value)} /></div>
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">Fecha Nacimiento</label><input type="date" className={inputClassName} value={form.personal.birthDate} onChange={(e) => updateSection('personal', 'birthDate', e.target.value)} /></div>
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">Sexo</label><select className={inputClassName} value={form.personal.gender} onChange={(e) => updateSection('personal', 'gender', e.target.value)}><option>M</option><option>F</option><option>Otro</option></select></div>
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">Profesión</label><input className={inputClassName} value={form.personal.profession} onChange={(e) => updateSection('personal', 'profession', e.target.value)} /></div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">Lugar Nacimiento</label><input list="credit-colombia-cities" className={inputClassName} value={form.personal.birthPlace} onChange={(e) => updateSection('personal', 'birthPlace', e.target.value)} /></div>
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">Estado Civil</label><select className={inputClassName} value={form.personal.maritalStatus} onChange={(e) => updateSection('personal', 'maritalStatus', e.target.value)}><option>Soltero</option><option>Casado</option><option>Unión libre</option><option>Separado</option></select></div>
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">N° de Hijos</label><select className={inputClassName} value={form.personal.childrenCount} onChange={(e) => updateSection('personal', 'childrenCount', e.target.value)}><option>Sin Hijos</option><option>1</option><option>2</option><option>3 o más</option></select></div>
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">Nivel de Estudio</label><select className={inputClassName} value={form.personal.educationLevel} onChange={(e) => updateSection('personal', 'educationLevel', e.target.value)}><option>Primaria</option><option>Bachillerato</option><option>Técnico</option><option>Tecnólogo</option><option>Universitario</option><option>Posgrado</option></select></div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">¿Con quién vive?</label><select className={inputClassName} value={form.personal.livesWith} onChange={(e) => updateSection('personal', 'livesWith', e.target.value)}><option>Cónyuge</option><option>Padres</option><option>Solo</option><option>Familia</option></select></div>
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">¿Tipo de vivienda?</label><select className={inputClassName} value={form.personal.housingType} onChange={(e) => updateSection('personal', 'housingType', e.target.value)}><option>Familiar</option><option>Propia</option><option>Arrendada</option></select></div>
                      <div>{renderFieldLabel('Teléfono Móvil', true)}<input className={requiredInputClassName} value={form.personal.mobilePhone} onChange={(e) => updateSection('personal', 'mobilePhone', e.target.value)} /></div>
                      <div>{renderFieldLabel('Ciudad')}<input list="credit-colombia-cities" className={inputClassName} value={form.personal.city} onChange={(e) => updateSection('personal', 'city', e.target.value)} /></div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>{renderFieldLabel('Dirección', true)}<input className={requiredInputClassName} value={form.personal.address} onChange={(e) => updateSection('personal', 'address', e.target.value)} /></div>
                      <div>{renderFieldLabel('Email', true)}<input type="email" className={requiredInputClassName} value={form.personal.email} onChange={(e) => updateSection('personal', 'email', e.target.value)} /></div>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-3">
                        {renderFieldLabel('Cédula Ciudadanía Cara Frontal', true)}
                        <input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => handleFileSelection('documentFront', e.target.files?.[0])} className="block w-full text-sm text-slate-600" />
                        {renderPreviewBox('Documento frontal', documentFrontPreview || accessAttachments.document_front, documentFront)}
                        {renderCaptureBox('documentFront', 'Documento frontal')}
                      </div>
                      <div className="space-y-3">
                        {renderFieldLabel('Cédula Ciudadanía Cara Posterior', true)}
                        <input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => handleFileSelection('documentBack', e.target.files?.[0])} className="block w-full text-sm text-slate-600" />
                        {renderPreviewBox('Documento posterior', documentBackPreview || accessAttachments.document_back, documentBack)}
                        {renderCaptureBox('documentBack', 'Documento posterior')}
                      </div>
                    </div>
                  </section>
                )}

                {step === 2 && (
                  <section className="space-y-6">
                    <h2 className="border-b pb-3 text-2xl font-bold text-slate-900">{STEP_TITLES[2]}</h2>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div>{renderFieldLabel('Actividad Económica', true)}<select className={requiredInputClassName} value={form.employment.activity} onChange={(e) => updateSection('employment', 'activity', e.target.value)}><option>Empleado</option><option>Independiente</option><option>Pensionado</option><option>Comerciante</option></select></div>
                      <div>{renderFieldLabel('Nombre Empresa', true)}<input className={requiredInputClassName} value={form.employment.companyName} onChange={(e) => updateSection('employment', 'companyName', e.target.value)} /></div>
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">Ciudad</label><input list="credit-colombia-cities" className={inputClassName} value={form.employment.companyCity} onChange={(e) => updateSection('employment', 'companyCity', e.target.value)} /></div>
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">Dirección</label><input className={inputClassName} value={form.employment.companyAddress} onChange={(e) => updateSection('employment', 'companyAddress', e.target.value)} /></div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">Ocupación o Cargo</label><input className={inputClassName} value={form.employment.jobTitle} onChange={(e) => updateSection('employment', 'jobTitle', e.target.value)} /></div>
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">Email de la empresa</label><input type="email" className={inputClassName} value={form.employment.companyEmail} onChange={(e) => updateSection('employment', 'companyEmail', e.target.value)} /></div>
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">Fecha Ingreso</label><input type="date" className={inputClassName} value={form.employment.startDate} onChange={(e) => updateSection('employment', 'startDate', e.target.value)} /></div>
                      <div>{renderFieldLabel('Salario', true)}<input inputMode="numeric" className={requiredInputClassName} value={formatMoneyInput(form.employment.salary)} onChange={(e) => updateMoneySection('employment', 'salary', e.target.value)} /></div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div><label className="mb-1 block text-sm font-semibold text-slate-700">Tipo de contrato</label><select className={inputClassName} value={form.employment.contractType} onChange={(e) => updateSection('employment', 'contractType', e.target.value)}><option>Indefinido</option><option>Fijo</option><option>Prestación de servicios</option><option>Temporal</option></select></div>
                    </div>
                    <div className="pt-4">
                      <h3 className="border-b pb-3 text-xl font-bold text-slate-900">Empresa Anterior</h3>
                      <div className="mt-4 grid gap-4 md:grid-cols-4">
                        <div><label className="mb-1 block text-sm font-semibold text-slate-700">Nombre Empresa</label><input className={inputClassName} value={form.employment.previousCompanyName} onChange={(e) => updateSection('employment', 'previousCompanyName', e.target.value)} /></div>
                        <div><label className="mb-1 block text-sm font-semibold text-slate-700">Actividad Empresa</label><input className={inputClassName} value={form.employment.previousCompanyActivity} onChange={(e) => updateSection('employment', 'previousCompanyActivity', e.target.value)} /></div>
                        <div><label className="mb-1 block text-sm font-semibold text-slate-700">Cargo</label><input className={inputClassName} value={form.employment.previousCompanyRole} onChange={(e) => updateSection('employment', 'previousCompanyRole', e.target.value)} /></div>
                        <div><label className="mb-1 block text-sm font-semibold text-slate-700">Tiempo Laborado</label><select className={inputClassName} value={form.employment.previousEmploymentTime} onChange={(e) => updateSection('employment', 'previousEmploymentTime', e.target.value)}><option>0 a 6 Meses</option><option>6 a 12 Meses</option><option>1 a 2 Años</option><option>Más de 2 Años</option></select></div>
                      </div>
                    </div>
                  </section>
                )}

                {step === 3 && (
                  <section className="space-y-6">
                    <h2 className="border-b pb-3 text-2xl font-bold text-slate-900">{STEP_TITLES[3]}</h2>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        {renderFieldLabel('Sueldo $', true)}
                        <input className={`${requiredInputClassName} bg-slate-50 text-slate-600`} value={formatMoneyInput(form.employment.salary)} readOnly />
                        <p className="mt-1 text-xs text-slate-500">Se toma automáticamente del salario registrado en Datos Laborales.</p>
                      </div>
                      <div>{renderFieldLabel('Comisiones $')}<input inputMode="numeric" className={inputClassName} value={formatMoneyInput(form.income.commissionsIncome)} onChange={(e) => updateMoneySection('income', 'commissionsIncome', e.target.value)} /></div>
                      <div>{renderFieldLabel('Otros Ingresos Permanentes')}<input inputMode="numeric" className={inputClassName} value={formatMoneyInput(form.income.otherIncome)} onChange={(e) => updateMoneySection('income', 'otherIncome', e.target.value)} /></div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>{renderFieldLabel('Detalle de Otros Ingresos')}<input className={inputClassName} value={form.income.otherIncomeDetail} onChange={(e) => updateSection('income', 'otherIncomeDetail', e.target.value)} /></div>
                      <div>{renderFieldLabel('Total Ingresos', true)}<input className={`${requiredInputClassName} bg-slate-50`} value={formatMoneyInput(form.income.totalIncome)} readOnly /></div>
                    </div>
                  </section>
                )}

                {step === 4 && (
                  <section className="space-y-6">
                    <h2 className="border-b pb-3 text-2xl font-bold text-slate-900">{STEP_TITLES[4]}</h2>
                    <div className="space-y-6">
                      {[
                        ['commercial', 'Referencias Comerciales'],
                        ['personal1', 'Referencia Personal 1'],
                        ['personal2', 'Referencia Personal 2'],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <h3 className="mb-3 text-xl font-bold text-slate-900">{label}</h3>
                          <div className="grid gap-4 md:grid-cols-4">
                            <div>{renderFieldLabel('Nombres', key !== 'commercial')}<input className={key !== 'commercial' ? requiredInputClassName : inputClassName} value={form.references[key].names} onChange={(e) => updateReference(key, 'names', e.target.value)} /></div>
                            <div><label className="mb-1 block text-sm font-semibold text-slate-700">Apellidos</label><input className={inputClassName} value={form.references[key].lastNames} onChange={(e) => updateReference(key, 'lastNames', e.target.value)} /></div>
                            <div>{renderFieldLabel('Teléfono', key !== 'commercial')}<input className={key !== 'commercial' ? requiredInputClassName : inputClassName} value={form.references[key].phone} onChange={(e) => updateReference(key, 'phone', e.target.value)} /></div>
                            <div><label className="mb-1 block text-sm font-semibold text-slate-700">Ciudad</label><input list="credit-colombia-cities" className={inputClassName} value={form.references[key].city} onChange={(e) => updateReference(key, 'city', e.target.value)} /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {step === 5 && (
                  <section className="space-y-6">
                    <h2 className="border-b pb-3 text-2xl font-bold text-slate-900">{STEP_TITLES[5]}</h2>
                    <div className="rounded-2xl border border-slate-200 p-5">
                      <label className="mb-3 flex items-start gap-3 text-sm text-slate-700">
                        <input type="checkbox" checked={form.consent.accepted} onChange={(e) => updateSection('consent', 'accepted', e.target.checked)} className="mt-1 h-4 w-4" />
                        <span>Estoy de acuerdo con la política de privacidad y autorizaciones de tratamiento de datos.</span>
                      </label>
                      <textarea readOnly value={POLICY_TEXT} className="h-64 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600 outline-none" />
                    </div>

                    <div className={`grid gap-6 ${requiresEmailValidation ? 'lg:grid-cols-[1fr_1fr]' : ''}`}>
                      <div className="space-y-4 rounded-2xl border border-slate-200 p-5">
                        <h3 className="text-lg font-bold text-slate-900">Firma</h3>
                        <div className="flex gap-3">
                          <button type="button" onClick={() => updateSection('consent', 'signatureMode', 'draw')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${form.consent.signatureMode === 'draw' ? 'text-white' : 'bg-slate-100 text-slate-700'}`} style={form.consent.signatureMode === 'draw' ? { backgroundColor: theme.primary } : undefined}>Firmar aquí</button>
                          <button type="button" onClick={() => updateSection('consent', 'signatureMode', 'upload')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${form.consent.signatureMode === 'upload' ? 'text-white' : 'bg-slate-100 text-slate-700'}`} style={form.consent.signatureMode === 'upload' ? { backgroundColor: theme.primary } : undefined}>Subir imagen / QR</button>
                        </div>

                        {form.consent.signatureMode === 'draw' ? (
                          <div className="space-y-3">
                            <div className="overflow-hidden rounded-2xl border border-dashed border-slate-300">
                              <canvas
                                ref={canvasRef}
                                width={720}
                                height={220}
                                className="h-56 w-full touch-none bg-white"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                              />
                            </div>
                            <button type="button" onClick={clearCanvas} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                              Limpiar firma
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileSelection('signatureFile', e.target.files?.[0])} className="block w-full text-sm text-slate-600" />
                            {renderPreviewBox('Firma cargada', signaturePreview || signatureCapture?.file_url || accessAttachments.signature_upload, signatureFile)}
                            {renderCaptureBox('signature', 'Firma')}
                          </div>
                        )}

                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-700">Nombre de quien firma</label>
                          <input className={inputClassName} value={form.consent.signatureName} onChange={(e) => updateSection('consent', 'signatureName', e.target.value)} />
                        </div>
                      </div>

                      {requiresEmailValidation && (
                        <div className="space-y-4 rounded-2xl border border-slate-200 p-5">
                          <h3 className="text-lg font-bold text-slate-900">Validación por correo</h3>
                          <p className="text-sm text-slate-500">Se enviará un código aleatorio al correo registrado para validar la solicitud.</p>
                          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                            <strong>Correo:</strong> {form.personal.email || 'Aún no registrado'}
                          </div>
                          <button type="button" onClick={sendVerificationCode} disabled={sendingCode} className="rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60" style={{ backgroundColor: theme.primary }}>
                            {sendingCode ? 'Enviando...' : accessToken ? 'Código enviado por asesor' : verificationSent ? 'Reenviar código' : 'Enviar código'}
                          </button>
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Código de verificación</label>
                            <div className="flex gap-3">
                              <input className={inputClassName} value={form.consent.verificationCode} onChange={(e) => updateSection('consent', 'verificationCode', e.target.value)} />
                              <button type="button" onClick={verifyCode} disabled={!verificationSent || verifyingCode} className="rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60" style={{ backgroundColor: theme.secondary }}>
                                {verifyingCode ? 'Confirmando...' : 'Confirmar código'}
                              </button>
                            </div>
                          </div>
                          {verificationVerified && (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                              Correo validado correctamente.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                )}

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  {step > 0 && (
                    <button type="button" onClick={prevStep} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">
                      Anterior
                    </button>
                  )}
                  {step < STEP_TITLES.length - 1 ? (
                    <button type="button" onClick={nextStep} className="rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ backgroundColor: theme.primary }}>
                      Siguiente
                    </button>
                  ) : (
                    <button type="button" onClick={handleSubmit} disabled={submitting} className="rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-60" style={{ backgroundColor: theme.primary }}>
                      {submitting ? 'Enviando...' : 'Enviar formulario'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        )}
      </main>
    </div>
  );
};

export default PublicCreditForm;
