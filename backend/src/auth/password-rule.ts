// Solo para contraseñas nuevas; el login no la exige para que las viejas sigan entrando.
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export const PASSWORD_RULE_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres, con letras y números';
