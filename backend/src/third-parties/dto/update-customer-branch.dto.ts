import { PartialType } from '@nestjs/mapped-types';
import { CustomerBranchDto } from './customer-branch.dto';

export class UpdateCustomerBranchDto extends PartialType(CustomerBranchDto) {}
