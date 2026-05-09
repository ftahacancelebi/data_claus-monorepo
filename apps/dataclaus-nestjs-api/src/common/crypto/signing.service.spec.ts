import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { SigningService } from './signing.service';

describe('SigningService', () => {
  let service: SigningService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SigningService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'AD_SIGNING_SECRET'
                ? 'test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
                : undefined,
          },
        },
      ],
    }).compile();
    service = module.get(SigningService);
  });

  describe('sign / verify', () => {
    it('round-trips a payload', () => {
      const signed = service.sign({ foo: 'bar', n: 42 });
      const verified = service.verify(signed);
      expect(verified).toEqual({ foo: 'bar', n: 42 });
    });

    it('rejects a tampered payload', () => {
      const signed = service.sign({ foo: 'bar' });
      const tampered = {
        ...signed,
        payload: { foo: 'evil' },
      };
      expect(() => service.verify(tampered)).toThrow(UnauthorizedException);
    });

    it('rejects a tampered signature', () => {
      const signed = service.sign({ foo: 'bar' });
      const tampered = { ...signed, signature: 'a'.repeat(64) };
      expect(() => service.verify(tampered)).toThrow(UnauthorizedException);
    });

    it('rejects an expired payload', () => {
      const signed = service.sign({ foo: 'bar' }, 1);
      // Wait past TTL
      const future = Date.now() + 1000;
      jest.spyOn(Date, 'now').mockReturnValue(future);
      expect(() => service.verify(signed)).toThrow(/expired/);
      (Date.now as jest.Mock).mockRestore();
    });

    it('rejects replay (same nonce twice)', () => {
      const signed = service.sign({ foo: 'bar' });
      service.verify(signed);
      expect(() => service.verify(signed)).toThrow(/[Rr]eplay/);
    });

    it('rejects malformed input', () => {
      expect(() => service.verify(null as never)).toThrow(UnauthorizedException);
      expect(() => service.verify({} as never)).toThrow(UnauthorizedException);
    });

    it('canonicalizes nested objects (key-order independent)', () => {
      const signed = service.sign({ a: 1, b: { c: 2, d: 3 } });
      // Re-construct envelope with reordered keys — signature must still verify
      const reordered = {
        ...signed,
        payload: { b: { d: 3, c: 2 }, a: 1 },
      };
      expect(() => service.verify(reordered)).not.toThrow();
    });
  });

  describe('encode / decode', () => {
    it('round-trips a token', () => {
      const token = service.signToken({ foo: 'bar' });
      const verified = service.verifyToken<{ foo: string }>(token);
      expect(verified.foo).toBe('bar');
    });

    it('rejects malformed tokens', () => {
      expect(() => service.verifyToken('!!!not-base64!!!')).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('hmacHex', () => {
    it('produces deterministic output', () => {
      const a = service.hmacHex('hello');
      const b = service.hmacHex('hello');
      expect(a).toBe(b);
      expect(a).toHaveLength(64); // sha256 hex
    });

    it('differs for different inputs', () => {
      expect(service.hmacHex('a')).not.toBe(service.hmacHex('b'));
    });
  });
});
