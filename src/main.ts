import { IKernel, IModule, Kernel } from '@hisorange/kernel';
import { Constructor } from '@loopback/context';
import 'dotenv-defaults/config';
import esMain from 'es-main';
import 'reflect-metadata';
import { AppModule } from './app/app.module';

export async function main(modules: Constructor<IModule>[]): Promise<IKernel> {
  const kernel = new Kernel();

  // Register the modules.
  if (kernel.register(modules)) {
    // Shutdown handler
    const shutdown = async () => {
      console.log('');

      // Graceful shutdown timeout
      setTimeout(() => {
        process.exit(5);
      }, 10_000);

      if (await kernel.stop()) {
        process.exit(0);
      }

      // Some module failed
      process.exit(4);
    };

    // Register the shutdown hooks.
    process.on('SIGINT', shutdown.bind(shutdown));
    process.on('SIGTERM', shutdown.bind(shutdown));

    // Boostrap the application!
    if (await kernel.boostrap()) {
      await kernel.start();
    } else {
      process.exit(3);
    }
  } else {
    process.exit(2);
  }

  return kernel;
}

// Direct invoking, run the application.
if (esMain(import.meta)) {
  main([AppModule]);
}
