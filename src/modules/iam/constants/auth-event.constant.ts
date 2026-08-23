export enum AuthEventSubject{
    LOGIN_SUCCESS = "login success",
    LOGIN_FAILED = "login failed",
    LOGOUT = "logout",
    PASSWORD_CHANGED = "password changed",
    PASSWORD_RESET = "password reset",
    EMAIL_VERIFIED = "email verified",
    OTP_SENT = "otp sent",
    OTP_VERIFIED = "otp verified",
    SESSION_CREATED = "session created",
    SESSION_REVOKED = "session revoked",
    ACCOUNT_LOCKED = "account locked"
}