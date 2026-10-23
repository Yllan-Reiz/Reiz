import type { LegalDoc, LegalCtx } from './types';

// Traducción al español de i18n/legal/fr.ts. Prevalece la versión francesa (se indica al principio de cada documento).
const NOTE = 'Esta traducción se ofrece por comodidad. En caso de diferencia, prevalece la versión francesa.';

export const legalEs = ({ withContacts, email }: LegalCtx): LegalDoc[] => [
  {
    id: 'cgu',
    title: 'Condiciones de uso',
    updated: '3 de octubre de 2026',
    intro: NOTE,
    sections: [
      { h: '1. Objeto', p: ['Reiz es una aplicación móvil para seguir objetivos personales y compartir el progreso con un círculo de amigos, editada por Yllan Karsenty. Al crear una cuenta, aceptas estas condiciones.'] },
      { h: '2. Cuenta', list: [
        'Debes tener al menos 15 años (o el consentimiento de tu padre, madre o tutor).',
        'Eres responsable de la confidencialidad de tu contraseña y de la actividad de tu cuenta.',
        'Una persona = una cuenta. La información que facilites debe ser exacta.',
      ] },
      { h: '3. Tu contenido', p: ['Sigues siendo propietario de lo que publicas (fotos, vídeos, textos, objetivos). Solo nos concedes la licencia técnica necesaria para alojarlo y mostrarlo a las personas autorizadas por tus ajustes de visibilidad. Eliminar tu contenido o tu cuenta pone fin a esta licencia.'] },
      { h: '4. Comportamientos prohibidos', list: [
        'Publicar contenido ilegal, de odio, violento, sexualmente explícito o que vulnere los derechos de otras personas.',
        'Acosar, suplantar una identidad o recopilar datos de otros usuarios.',
        'Perturbar el funcionamiento del servicio (spam, acceso no autorizado, ingeniería inversa).',
      ] },
      { h: '5. Moderación', p: [`Cada publicación y cada comentario se puede denunciar, y cada usuario se puede bloquear desde la app. Las denuncias se revisan y pueden dar lugar a la retirada del contenido o a la suspensión de la cuenta. Para un problema urgente: ${email}.`] },
      { h: '6. Eliminación de la cuenta', p: ['Puedes eliminar tu cuenta en cualquier momento desde Ajustes y luego «Eliminar mi cuenta». Esta acción es inmediata e irreversible.'] },
      { h: '7. Responsabilidad', p: ['Reiz se ofrece «tal cual», en fase de lanzamiento. Hacemos lo posible por mantener el servicio disponible, pero no garantizamos que esté libre de interrupciones o errores. Reiz es una herramienta de motivación: no ofrece ningún consejo médico, deportivo ni financiero. Escucha a tu cuerpo y entrena en condiciones seguras.'] },
      { h: '8. Datos personales', p: ['El tratamiento de tus datos se describe en la Política de privacidad.'] },
      { h: '9. Ley aplicable', p: ['Estas condiciones se rigen por la ley francesa. Cualquier litigio se someterá a los tribunales franceses competentes, tras intentar una solución amistosa.'] },
    ],
  },
  {
    id: 'privacy',
    title: 'Política de privacidad',
    updated: withContacts ? '22 de octubre de 2026' : '3 de octubre de 2026',
    intro: NOTE,
    sections: [
      { h: '1. ¿Quiénes somos?', p: [`Reiz es una aplicación móvil editada por Yllan Karsenty («nosotros»). Permite seguir tus objetivos personales y compartir tu progreso con un círculo de amigos. Para cualquier pregunta sobre tus datos: ${email}.`] },
      { h: '2. Datos que recopilamos', list: [
        'Datos de cuenta: dirección de email, nombre, nombre de usuario, contraseña (cifrada, nunca legible por nosotros). Si inicias sesión con Apple o Google, recibimos tu email y tu nombre de ese servicio.',
        'Contenido que publicas: objetivos, progreso, fotos, vídeos (con su sonido), descripciones, comentarios, reacciones, foto de perfil, bio, etiquetas de perfil y deporte elegido.',
        'Datos sociales: lista de amigos, círculo cercano, solicitudes de amistad, bloqueos, denuncias.',
        'Datos técnicos: token de notificaciones push de tu dispositivo (si aceptas las notificaciones), registros técnicos de seguridad.',
        'Lugares de entreno (opcional): si activas la detección de llegada, tu ubicación se lee en tu teléfono para saber cuándo llegas a un lugar que has elegido (tu gimnasio, tu pista). Las coordenadas de esos lugares se quedan en tu teléfono y nunca se envían a nuestros servidores. Solo se registra el evento «ha llegado a <nombre del lugar>», con la hora, visible para tu círculo cercano.',
        ...(withContacts ? ['Contactos (opcional): si tocas «Encontrar mis contactos», tu teléfono te pide acceso a tu agenda. Los nombres, emails y números se quedan en tu teléfono. Para decirte cuáles de tus contactos ya están en Reiz, la aplicación calcula una huella de cada dirección de email (una versión cifrada en un solo sentido, SHA-256) y solo envía esas huellas a nuestros servidores. Estos las comparan con las de las cuentas de Reiz y responden con las cuentas que coinciden (nombre, nombre de usuario, foto de perfil), sin conservar esas huellas. Los números solo sirven para abrir Mensajes con un texto de invitación ya escrito: no se envía nada hasta que tocas «Enviar».'] : []),
      ], p: [withContacts
        ? 'No recopilamos ningún dato publicitario ni ninguna ubicación fuera de la función «Lugares de entreno», y nunca conservamos tu agenda. No vendemos ningún dato.'
        : 'No recopilamos contactos, ni datos publicitarios, ni ninguna ubicación fuera de la función opcional anterior. No vendemos ningún dato.'] },
      { h: '3. Para qué (bases legales)', list: [
        'Prestar el servicio (ejecución del contrato): cuenta, feed, amigos, publicaciones.',
        'Notificaciones push (consentimiento): puedes rechazarlas o desactivarlas en cualquier momento en los ajustes de tu teléfono.',
        'Seguridad y moderación (interés legítimo): gestión de denuncias, prevención de abusos.',
        'Ubicación y aviso a tu círculo cercano (consentimiento): activas la función tú mismo, después de una explicación. Puedes desactivarla en cualquier momento en Ajustes, «Avisar a mi círculo cercano», o en los ajustes de ubicación de tu iPhone.',
        ...(withContacts ? ['Encontrar tus contactos (consentimiento): inicias la función tú mismo, y tu teléfono pide el acceso a la agenda en ese momento. Puedes retirarlo en cualquier momento en los ajustes de tu iPhone, apartado Reiz, Contactos.'] : []),
      ] },
      { h: '4. ¿Dónde se guardan tus datos?', p: ['Tus datos están alojados por Supabase en servidores situados en la Unión Europea (Estocolmo, Suecia). Supabase actúa como encargado del tratamiento según el RGPD. Si aceptas las notificaciones, se envían a través del servicio de notificaciones de Expo y después de Apple o Google, que reciben el token de tu dispositivo y el texto de la notificación.'] },
      { h: '5. ¿Quién ve tu contenido?', p: ['Tu progreso es visible según la visibilidad que elijas para cada objetivo: Mi círculo (tus amigos), Círculo cercano (los amigos que has elegido) o Solo yo. Tu nombre, tu nombre de usuario, tu foto de perfil, tu bio y tu deporte son visibles para los usuarios conectados (búsqueda de amigos). Tu deporte y tus etiquetas de perfil también permiten que te encuentre la gente que hace el mismo deporte; puedes quitar tu deporte desde tu perfil. Los avisos «estoy en el gimnasio» solo los ve tu círculo cercano. Si compartes una imagen de tu progreso en Instagram, eres tú quien decide publicarla: Reiz nunca publica nada en tu nombre.' + (withContacts ? ' Si alguien tiene tu dirección de email en sus contactos y usa «Encontrar mis contactos», puede ver que estás en Reiz, con tu nombre, tu nombre de usuario y tu foto de perfil. Los usuarios bloqueados, en un sentido u otro, no aparecen en esos resultados, y una cuenta creada con «Ocultar mi correo» de Apple no se puede encontrar de esta forma. También puedes negarte a que te encuentren así: Ajustes, Privacidad, «Sugerirme a mis contactos».' : '')] },
      { h: '6. ¿Durante cuánto tiempo?', p: ['Tus datos se conservan mientras exista tu cuenta. Eliminar tu cuenta (Ajustes y luego «Eliminar mi cuenta») borra de inmediato y para siempre tu cuenta, tus publicaciones, tus fotos, tus vídeos, tus objetivos y tus vínculos de amistad.' + (withContacts ? ' Las huellas de email enviadas para encontrar tus contactos no se conservan.' : '')] },
      { h: '7. Tus derechos (RGPD)', p: [`Tienes derecho de acceso, rectificación, supresión, portabilidad, limitación y oposición. Puedes ejercerlos directamente en la app (edición del perfil, «Exportar mis datos», eliminación de la cuenta) o escribiendo a ${email}. También puedes dirigirte a la CNIL (cnil.fr), la autoridad francesa de protección de datos.`] },
      { h: '8. Menores', p: ['Reiz está reservado a personas de 15 años o más. Si tienes menos de 15 años, se necesita el consentimiento de tu padre, madre o tutor.'] },
      { h: '9. Cambios', p: ['Esta política puede cambiar. La fecha de arriba indica la última versión; si hay un cambio importante, te avisaremos en la app.'] },
    ],
  },
  {
    id: 'rules',
    title: 'Normas de la comunidad',
    updated: '3 de octubre de 2026',
    intro: 'Reiz se basa en la confianza: tu círculo te mira, y tú miras el suyo. Para que siga siendo un sitio que dé ganas de superarse, esto es lo que esperamos de cada uno.\n\n' + NOTE,
    sections: [
      { h: 'Lo que animamos a hacer', list: [
        'Publicar pruebas reales de tu progreso, aunque sean pequeñas.',
        'Animar a los demás: una reacción o un comentario sincero marcan la diferencia.',
        'Respetar el ritmo de cada uno: comparamos el esfuerzo, no el rendimiento.',
      ] },
      { h: 'Lo que no se acepta', list: [
        'Burlas, acoso, presión o body shaming.',
        'Contenido sexual, violento, de odio o discriminatorio.',
        'Contenido falso, suplantación de identidad, spam.',
        'Retos o consejos peligrosos para la salud (privación, dopaje, sobreentrenamiento).',
        'Publicar la foto o el vídeo de una persona sin su consentimiento.',
      ] },
      { h: 'Si algo no va bien', list: [
        'Denuncia una publicación o un comentario con el menú «…» o manteniendo pulsado.',
        'Bloquea a un usuario desde su perfil: ya no verá tus publicaciones ni tú las suyas.',
        `Para un problema urgente, escríbenos: ${email}.`,
      ], p: ['Las denuncias se revisan. Según la gravedad, podemos retirar un contenido o suspender una cuenta.'] },
      { h: 'Tu seguridad', p: ['Reiz no sustituye a un entrenador ni a un médico. Si sientes dolor o malestar, para. Nunca compartas tu dirección ni tus datos personales en un comentario.'] },
    ],
  },
];
