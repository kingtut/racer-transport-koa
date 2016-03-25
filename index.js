var   router = require( "koa-router" )(),
      websockify = require( "koa-websocket" ),
      SocketStream = require( "./lib/socket-stream" ),
      BrowserChannelServer = require("browserchannel").server,
      connect = require("browserchannel/node_modules/connect");
      WebSocket = require('koa-websocket/node_modules/ws');

function Transport( racerStore, options ){
   this.racerStore = racerStore;
   this.options = options;
}
Transport.prototype.connect = function( app ){
   var self = this;
   var sessionEnable = !!this.options.session;
   var racerStore = this.racerStore;

   // web socket
   websockify( app );

   router.get( this.options.channelName, function *( next ){
      var client = this.websocket;
      var stream = new SocketStream( client );
      if(this.session) client.session = this.session;
      racerStore.listen( stream, client.upgradeReq );

      if (!self.options.noPing){
         client.timer = setInterval(function(){
            if (client.readyState === WebSocket.OPEN) {
               client.ping();
            } else {
               clearInterval(client.timer);
            }
         }, self.options.pingInterval);
      }

      yield next;
   });

   if( sessionEnable ) app.ws.use( this.options.session );

   app.ws.use( router.routes() );

   // browserchannel
   this.options.base = this.options.channelName;
   var BCmiddleware = BrowserChannelServer(this.options, function (client, connectRequest) {
      if(connectRequest.session) client.session = connectRequest.session;
      var stream = new SocketStream( client );
      racerStore.listen( stream, connectRequest );
   });

   app.use( function * (next) {
      if(sessionEnable) {
         // readonly session koa -> connect (BCmiddleware stop generator chain and session difference not saved)
         this.req.session = this.session;
      }
      yield BCmiddleware.bind(null, this.req, this.res);
      yield next;
   });
};

module.exports = Transport;
