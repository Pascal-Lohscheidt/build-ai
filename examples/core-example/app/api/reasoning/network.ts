import { AgentNetwork } from '@m4trix/core/matrix';
import { exampleAgent } from './example-agent';

export const network = AgentNetwork.setup(
  ({ mainChannel, createChannel, sink, registerAgent }) => {
    const main = mainChannel('main');
    const client = createChannel('client').sink(sink.httpStream());

    registerAgent(exampleAgent).subscribe(main).publishTo(client);
  },
);
