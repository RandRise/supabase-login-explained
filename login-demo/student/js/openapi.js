export function createSpec(url) {
  const error = { description: 'Supabase rejected the request. Read the actual response body.' };
  const protectedSecurity = [{ ProjectKey: [], BearerAuth: [] }];
  const body = (properties, required = []) => ({
    required: true,
    content: { 'application/json': { schema: { type: 'object', properties, required } } },
  });
  const responses = {
    200: { description: 'Actual server response' },
    400: error,
    401: error,
    403: error,
  };
  return {
    openapi: '3.0.3',
    info: {
      title: 'Student Portal API',
      version: '1.0.0',
      description:
        'Real requests to your Supabase test project. The project key identifies the app. The bearer token identifies the student. Use the controls above to attach or remove the token. Answers use zero-based option numbers. No passwords are sent to these quiz endpoints.',
    },
    servers: [{ url }],
    components: {
      securitySchemes: {
        ProjectKey: {
          type: 'apiKey',
          in: 'header',
          name: 'apikey',
          description: 'Public project key; supplied automatically.',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'A student access token. Use the portal session button or paste a token here. Never use a service-role key.',
        },
      },
    },
    security: protectedSecurity,
    tags: [{ name: 'Quiz' }, { name: 'Identity & ownership' }],
    paths: {
      '/rest/v1/rpc/team3_get_quiz': {
        post: {
          tags: ['Quiz'],
          summary: 'Get public questions — no student token needed',
          operationId: 'getQuiz',
          security: [{ ProjectKey: [] }],
          requestBody: body({}),
          responses,
        },
      },
      '/rest/v1/rpc/team3_submit_quiz': {
        post: {
          tags: ['Quiz'],
          summary: 'Submit answers — score is calculated by the database',
          operationId: 'submitQuiz',
          requestBody: body(
            {
              p_answers: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: { type: 'integer', minimum: 0, maximum: 2 },
                example: [1, 2, 0],
              },
            },
            ['p_answers'],
          ),
          responses,
        },
      },
      '/rest/v1/rpc/team3_get_result': {
        post: {
          tags: ['Identity & ownership'],
          summary: 'Read your result — try another student ID to get 403',
          operationId: 'getResult',
          description:
            'Leave p_student_id null for your own result. Another student UUID is refused, even with a valid token. No attempt yet is a successful response with latest: null.',
          requestBody: body({
            p_student_id: { type: 'string', format: 'uuid', nullable: true, example: null },
          }),
          responses,
        },
      },
      '/rest/v1/team3_quiz_students': {
        get: {
          tags: ['Identity & ownership'],
          summary: 'List the two invented student IDs for the ownership test',
          operationId: 'getRoster',
          parameters: [
            {
              in: 'query',
              name: 'select',
              schema: {
                type: 'string',
                enum: ['user_id,display_name'],
                default: 'user_id,display_name',
              },
            },
          ],
          responses,
        },
      },
      '/rest/v1/team3_quiz_attempts': {
        get: {
          tags: ['Identity & ownership'],
          summary: 'Query the table directly — row-level security still applies',
          operationId: 'getAttempts',
          description:
            'Set student_id to eq.UUID. Alice querying Bob returns 200 with an empty array, not 403. First confirm Bob has a result with his own token.',
          parameters: [
            {
              in: 'query',
              name: 'student_id',
              schema: { type: 'string' },
              description: 'eq.STUDENT_UUID',
            },
            {
              in: 'query',
              name: 'select',
              schema: { type: 'string', default: 'id,student_id,score,submitted_at' },
            },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 5, maximum: 100 } },
          ],
          responses,
        },
      },
    },
  };
}
