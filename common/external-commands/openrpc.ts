import type { ExternalApiMethod } from '@project/common/external-commands/external-api';
import { z } from 'zod';

export interface OpenRpcDocumentSource {
    methods: Record<string, ExternalApiMethod>;
    externalExtensionPortName: string;
}

// scripts/generate-openrpc.ts commits the result to external-api/openrpc.json.

interface JsonSchemaObject {
    properties?: Record<string, object>;
    required?: string[];
    [key: string]: unknown;
}

interface ContentDescriptor {
    name: string;
    required?: boolean;
    schema: object;
    description?: string;
}

interface MethodDefinition {
    name: string;
    summary: string;
    description: string;
    tags: { name: string }[];
    paramStructure: 'by-name';
    params: ContentDescriptor[];
    result: ContentDescriptor;
}

function methodDefinition(method: ExternalApiMethod): MethodDefinition {
    let params: ContentDescriptor[] = [];
    const schema = toJsonSchema(method.paramsSchema, 'input') as JsonSchemaObject;
    const required = schema.required ?? [];
    const propertyNames = Object.keys(schema.properties ?? {});

    if (propertyNames.length > 0) {
        params = propertyNames.map((name) => ({
            name,
            required: required.includes(name),
            schema: schema.properties![name],
            description: method.paramDescriptions?.[name],
        }));
    }

    return {
        name: method.name,
        summary: method.summary,
        description: method.description,
        tags: method.tags.map((name) => ({ name })),
        paramStructure: 'by-name',
        params,
        result: {
            name: 'result',
            schema: toJsonSchema(method.resultSchema, 'output'),
            description: method.resultDescription,
        },
    };
}

export function generateOpenRpcDocument({ methods, externalExtensionPortName }: OpenRpcDocumentSource): object {
    return {
        openrpc: '1.0.0',
        info: {
            title: 'asbplayer External API',
            version: '1.0.0',
            description:
                'JSON-RPC 2.0 API for external clients of asbplayer: the WebSocket servers (Go server, Anki addon ' +
                `server) and the external extension API (browser.runtime port \`${externalExtensionPortName}\`). See ` +
                'external-api/README.md for transport framings, error codes, and licensing.',
            license: {
                name: 'Unlicense',
            },
        },
        methods: Object.values(methods).map(methodDefinition),
    };
}

export function serializeOpenRpcDocument(document: object): string {
    return `${JSON.stringify(document, null, 4)}\n`;
}

// Draft-07 JSON Schema without the injected `$schema` header: the OpenRPC document declares the
// dialect. `io` selects the direction so defaults/transforms match the caller's view.
export function toJsonSchema(schema: z.ZodType, io: 'input' | 'output'): object {
    const { $schema, ...jsonSchema } = z.toJSONSchema(schema, { target: 'draft-7', io });

    void $schema;

    return jsonSchema;
}
