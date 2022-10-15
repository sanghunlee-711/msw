import {
  Interceptor,
  BatchInterceptor,
  HttpRequestEventMap,
} from '@mswjs/interceptors'
import { FetchInterceptor } from '@mswjs/interceptors/lib/interceptors/fetch'
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/lib/interceptors/XMLHttpRequest'
import { SetupWorkerInternalContext, StartOptions } from '../glossary'
import type { RequiredDeep } from '../../typeUtils'
import { handleRequest } from '../../utils/handleRequest'

export function createFallbackRequestListener(
  context: SetupWorkerInternalContext,
  options: RequiredDeep<StartOptions>,
): Interceptor<HttpRequestEventMap> {
  const interceptor = new BatchInterceptor({
    name: 'fallback',
    interceptors: [new FetchInterceptor(), new XMLHttpRequestInterceptor()],
  })

  interceptor.on('request', async (request, requestId) => {
    const response = await handleRequest(
      request,
      requestId,
      context.requestHandlers,
      options,
      context.emitter,
      {
        onMockedResponse(_, { handler, request, parsedRequest }) {
          if (!options.quiet) {
            context.emitter.once('response:mocked', (response) => {
              handler.log(request, response, parsedRequest)
            })
          }
        },
      },
    )

    if (response) {
      request.respondWith(response)
    }
  })

  interceptor.on('response', (response, request, requestId) => {
    if (response.headers.get('x-powered-by') === 'msw') {
      context.emitter.emit('response:mocked', response, request, requestId)
    } else {
      context.emitter.emit('response:bypass', response, request, requestId)
    }
  })

  interceptor.apply()

  return interceptor
}
