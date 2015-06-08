
/*!
 * Copyright (c) 2012 Andrew Volkov <hello@vol4ok.net>
 */

(function() {
  var $, cache, ctx, customContent, extend, hogan, isObj, read, render, renderLayout, renderPartials,
    slice = [].slice,
    hasProp = {}.hasOwnProperty;

  extend = function() {
    var dest, i, k, len, src, srcs, v;
    dest = arguments[0], srcs = 2 <= arguments.length ? slice.call(arguments, 1) : [];
    for (i = 0, len = srcs.length; i < len; i++) {
      src = srcs[i];
      for (k in src) {
        if (!hasProp.call(src, k)) continue;
        v = src[k];
        if (isObj(v)) {
          dest[k] = extend({}, src[k]);
        } else {
          dest[k] = v;
        }
      }
    }
    return dest;
  };

  isObj = function(obj) {
    return obj.toString() === '[object Object]';
  };

  $ = {};

  extend($, require('fs'));

  extend($, require('util'));

  extend($, require('path'));

  hogan = require('hogan.js');

  cache = {};

  ctx = {};

  read = function(path, options, fn) {
    var str;
    str = cache[path];
    if (options.cache && str) {
      return fn(null, str);
    }
    return $.readFile(path, 'utf8', function(err, str) {
      if (err) {
        return fn(err);
      }
      str = str.replace(/^\uFEFF/, '');
      if (options.cache) {
        cache[path] = str;
      }
      return fn(null, str);
    });
  };

  renderPartials = function(partials, opt, fn) {
    var count, name, path, result;
    count = 1;
    result = {};
    for (name in partials) {
      path = partials[name];
      if (typeof path !== 'string') {
        continue;
      }
      if (!$.extname(path)) {
        path += ctx.ext;
      }
      path = ctx.lookup(path);
      count++;
      read(path, opt, (function(name, path) {
        return function(err, str) {
          if (!count) {
            return;
          }
          if (err) {
            count = 0;
            fn(err);
          }
          result[name] = str;
          if (!--count) {
            return fn(null, result);
          }
        };
      })(name, path));
    }
    if (!--count) {
      return fn(null, result);
    }
  };

  renderLayout = function(path, opt, fn) {
    if (!path) {
      return fn(null, false);
    }
    if (!$.extname(path)) {
      path += ctx.ext;
    }
    path = ctx.lookup(path);
    if (!path) {
      return fn(null, false);
    }
    return read(path, opt, function(err, str) {
      if (err) {
        return fn(err);
      }
      return fn(null, str);
    });
  };

  customContent = function(str, tag, opt, partials) {
    var cTag, oTag, text;
    oTag = "{{#" + tag + "}}";
    cTag = "{{/" + tag + "}}";
    text = str.substring(str.indexOf(oTag) + oTag.length, str.indexOf(cTag));
    return hogan.compile(text, opt).render(opt, partials);
  };

  render = function(path, opt, fn) {
    var fn1, lambda, lambdas, name, partials;
    ctx = this;
    partials = opt.settings.partials || {};
    if (opt.partials) {
      partials = extend(partials, opt.partials);
    }
    lambdas = opt.settings.lambdas || {};
    if (opt.lambdas) {
      lambdas = extend(lambdas, opt.lambdas);
    }
    opt.lambdas = {};
    fn1 = function(name, lambda) {
      return opt.lambdas[name] = function() {
        var lcontext;
        lcontext = this;
        return function(text) {
          var lctx;
          lctx = {};
          if (opt._locals) {
            lctx = extend(lctx, opt._locals);
          }
          lctx = extend(lctx, lcontext);
          return lambda(hogan.compile(text).render(lctx));
        };
      };
    };
    for (name in lambdas) {
      lambda = lambdas[name];
      fn1(name, lambda);
    }
    return renderPartials(partials, opt, function(err, partials) {
      var layout;
      if (err) {
        return fn(err);
      }
      layout = opt.layout === void 0 ? opt.settings.layout : layout = opt.layout;
      return renderLayout(layout, opt, function(err, layout) {
        return read(path, opt, function(err, str) {
          var customTag, customTags, i, len, result, tag, tmpl, yields;
          if (err) {
            return fn(err);
          }
          try {
            tmpl = hogan.compile(str, opt);
            result = tmpl.render(opt, partials);
            customTags = str.match(/({{#yield-\w+}})/g);
            yields = {};
            if (customTags) {
              for (i = 0, len = customTags.length; i < len; i++) {
                customTag = customTags[i];
                tag = customTag.match(/{{#([\w-]+)}}/)[1];
                if (tag) {
                  if (layout) {
                    opt[tag] = customContent(str, tag, opt, partials);
                  } else {
                    yields[tag.replace('yield-', '')] = customContent(str, tag, opt, partials);
                  }
                }
              }
            }
            if (layout) {
              opt["yield"] = result;
              tmpl = hogan.compile(layout, opt);
              result = tmpl.render(opt, partials);
              return fn(null, result);
            }
            return fn(null, result, yields);
          } catch (_error) {
            err = _error;
            return fn(err);
          }
        });
      });
    });
  };

  module.exports = render;

}).call(this);
