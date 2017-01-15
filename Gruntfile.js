module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        'dependency-check': {
            options: {
                excludeUnusedDev: true
            },
            files: ['<%= jshint.files %>']
        },
        jshint: {
            files: ['index.js','lib/**/*.js'],
            options: '<%= pkg.jshintConfig %>'
        },
        watch: {
            package: {
                files: ['<%= jshint.files %>','package.json'],
                tasks: ['dependency-check']
            },
            scripts: {
                files: ['<%= jshint.files %>'],
                tasks: ['jshint']
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('dependency-check');

    grunt.registerTask('default', ['dependency-check','jshint']);
};
