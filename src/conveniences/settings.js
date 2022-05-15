'use strict';

const { Gio, GLib, Gdk, Clutter } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;

/// An enum non-extensively describing the type of a gsettings key.
var Type = {
    B: 'Boolean',
    I: 'Integer',
    D: 'Double',
    S: 'String',
    C: 'Color'
};

/// An object to get and manage the gsettings preferences.
///
/// Should be initialized with an array of keys, for example:
///
/// let prefs = new Prefs([
///     { type: Type.I, name: "panel-corner-radius" },
///     { type: Type.B, name: "debug" }
/// ]);
///
/// Each {type, name} object represents a gsettings key, which must be created
/// in the gschemas.xml file of the extension.
var Prefs = class Prefs {
    constructor(keys) {
        let settings = this.settings = ExtensionUtils.getSettings();
        this.keys = keys;

        this.keys.forEach(bundle => {
            let component = this;
            let component_settings = settings;
            if (bundle.component != "general") {
                let bundle_component = bundle.component.replaceAll('-', '_');
                this[bundle_component] = {
                    settings: this.settings.get_child(bundle.component)
                };
                component = this[bundle_component];
                component_settings = settings.get_child(bundle.component);
            }


            bundle.schemas.forEach(key => {
                let property_name = this.get_property_name(key.name);

                switch (key.type) {
                    case Type.B:
                        Object.defineProperty(component, property_name, {
                            get() {
                                return component_settings.get_boolean(key.name);
                            },
                            set(v) {
                                component_settings.set_boolean(key.name, v);
                            }
                        });
                        break;

                    case Type.I:
                        Object.defineProperty(component, property_name, {
                            get() {
                                return component_settings.get_int(key.name);
                            },
                            set(v) {
                                component_settings.set_int(key.name, v);
                            }
                        });
                        break;

                    case Type.D:
                        Object.defineProperty(component, property_name, {
                            get() {
                                return component_settings.get_double(key.name);
                            },
                            set(v) {
                                component_settings.set_double(key.name, v);
                            }
                        });
                        break;

                    case Type.S:
                        Object.defineProperty(component, property_name, {
                            get() {
                                return component_settings.get_string(key.name);
                            },
                            set(v) {
                                component_settings.set_string(key.name, v);
                            }
                        });
                        break;

                    case Type.C:
                        Object.defineProperty(component, property_name, {
                            // returns the array [red, blue, green, alpha] with
                            // values between 0 and 1
                            get() {
                                let val = component_settings.get_value(key.name);
                                return val.deep_unpack();
                            },
                            // takes an array [red, blue, green, alpha] with
                            // values between 0 and 1
                            set(v) {
                                let val = new GLib.Variant("(dddd)", v);
                                component_settings.set_value(key.name, val);
                            }
                        });

                        Object.defineProperty(component, property_name + '_clutter', {
                            // returns the corresponding Clutter.Color
                            get() {
                                let [r, g, b, a] = component[property_name];
                                let c = new Clutter.Color({
                                    red: r * 255,
                                    green: g * 255,
                                    blue: b * 255,
                                    alpha: a
                                });
                                return c;
                            }
                        });

                        Object.defineProperty(component, property_name + '_gdk', {
                            // returns the corresponding Gdk.RGBA color
                            get() {
                                let [r, g, b, a] = component[property_name];
                                let c = new Gdk.RGBA;
                                c.red = r;
                                c.green = g;
                                c.blue = b;
                                c.alpha = a;
                                return c;
                            }
                        });
                        break;
                }

                component[property_name + '_changed'] = function (cb) {
                    return component_settings.connect('changed::' + key.name, cb);
                };

                component[property_name + '_disconnect'] = function () {
                    return component_settings.disconnect.apply(
                        component_settings, arguments
                    );
                };
            });
        });
    };

    /// From the gschema name, returns the name of the associated property on
    /// the Prefs object.
    get_property_name(name) {
        return name.replaceAll('-', '_').toUpperCase();
    }

    /// Remove all connections managed by the Prefs object, i.e. created with
    /// `prefs.PROPERTY_changed(callback)`.
    disconnect_all_settings() {
        this.keys.forEach(bundle => {
            let component = this;
            if (bundle.component != "general") {
                let bundle_component = bundle.component.replaceAll('-', '_');
                component = this[bundle_component];
            }

            bundle.schemas.forEach(key => {
                let property_name = this.get_property_name(key.name);
                component[property_name + '_disconnect']();
            });
        });
    }

    /// Given a component (described by its preferences node), a gschema key and
    /// a Gtk.ColorButton, binds everything transparently.
    bind_color(component, key, widget) {
        let property_name = this.get_property_name(key);

        let parse_color = _ => {
            let [r, g, b, a] = component[property_name];
            let w = widget.rgba;
            w.red = r;
            w.green = g;
            w.blue = b;
            w.alpha = a;
            widget.rgba = w;
        };
        component.settings.connect('changed::' + key, parse_color);

        widget.connect('color-set', _ => {
            let c = widget.rgba;
            component[property_name] = [c.red, c.green, c.blue, c.alpha];
        });

        parse_color();
    };
};