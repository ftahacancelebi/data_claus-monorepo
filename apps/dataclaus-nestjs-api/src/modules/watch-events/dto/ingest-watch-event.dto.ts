import { IsBoolean, IsInt, IsString, IsUUID, Min } from 'class-validator';

export class IngestWatchEventDto {
  @IsUUID()
  applicationId: string;

  @IsUUID()
  userId: string;

  @IsString()
  videoId: string;

  @IsInt()
  @Min(0)
  dwellMs: number;

  @IsBoolean()
  completed: boolean;
}
