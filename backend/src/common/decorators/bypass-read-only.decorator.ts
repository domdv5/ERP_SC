import { SetMetadata } from '@nestjs/common';

export const BYPASS_READ_ONLY_KEY = 'bypassReadOnly';
export const BypassReadOnly = () => SetMetadata(BYPASS_READ_ONLY_KEY, true);
