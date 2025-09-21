#!/usr/bin/env node

// Test that the plugin can be properly loaded
console.log('Testing plugin export...');

async function testPlugin() {
  try {
    const pluginModule = await import('./opencode-plugin/dist/plugin.js');
    const plugin = pluginModule.default;
    
    console.log('✅ Plugin loaded successfully');
    console.log('Plugin type:', typeof plugin);
    
    if (typeof plugin === 'function') {
      console.log('✅ Plugin is a function (correct)');
      
      // Try to call it with minimal mock parameters
      try {
        const mockClient = {
          session: {
            prompt: () => console.log('Mock session.prompt called')
          }
        };
        const mockProject = {};
        const mockDirectory = '';
        
        console.log('Calling plugin with mock parameters...');
        const result = await plugin({
          client: mockClient,
          project: mockProject,
          directory: mockDirectory
        });
        console.log('✅ Plugin executed successfully');
        console.log('Plugin result type:', typeof result);
        
        if (result && typeof result === 'object') {
          const hooks = Object.keys(result);
          console.log('✅ Plugin returned object with', hooks.length, 'hooks:', hooks);
          
          // Show hook details
          hooks.forEach(hook => {
            const handler = result[hook];
            console.log(`  - ${hook}: ${typeof handler} ${typeof handler === 'function' ? '(function)' : ''}`);
          });
        } else {
          console.log('Plugin result (not object):', result);
        }
        
      } catch (error) {
        console.log('❌ Plugin execution error:', error.message);
        console.log('Stack trace:', error.stack);
      }
      
    } else {
      console.log('❌ Plugin is not a function, type:', typeof plugin);
    }
    
  } catch (error) {
    console.log('❌ Failed to load plugin:', error.message);
  }

  console.log('\nPlugin export test complete!');
}

testPlugin();