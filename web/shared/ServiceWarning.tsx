import { Component, Show, createMemo } from 'solid-js'
import { AIAdapter } from '/common/adapters'
import { userStore } from '../store/user'
import { A } from '@solidjs/router'

const ServiceWarning: Component<{ service: AIAdapter | undefined }> = (props) => {
  const user = userStore((s) => ({ ...s.user }))

  const isKeySet = createMemo(() => {
    const svc = props.service
    if (!svc) return true

    if (svc === 'openai' && !user.oaiKeySet) return false
    if (svc === 'novel' && !user.novelVerified) return false
    if (svc === 'claude' && !user.claudeApiKeySet) return false
    if (svc === 'scale' && !user.scaleApiKeySet) return false
    if (svc === 'goose' && !user.adapterConfig?.goose?.apiKeySet) return false

    return true
  })

  return (
    <>
      <Show when={!isKeySet()}>
        <span class="text-orange-500">
          This service requires an API key to be set. Go to your{' '}
          <A class="link" href="/settings">
            Settings
          </A>{' '}
          to set the API key.
        </span>
      </Show>
      <Show when={props.service === 'horde' && !user?.hordeName}>
        <span class="text-orange-500">
          Register at{' '}
          <a class="link" href="https://aihorde.net/register" target="_blank">
            AIHorde
          </a>{' '}
          for a better Horde experience.
        </span>
      </Show>
    </>
  )
}

export default ServiceWarning
